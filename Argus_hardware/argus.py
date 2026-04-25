
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                ARGUS — Crash Detection with Web Config                       ║
║                               Team Arise                                     ║
║           Features: SMS Alert , HTTPS post , LOGS reporting                  ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import threading
import RPi.GPIO as GPIO
import logging
import serial
import time
import os
import subprocess
import json
import requests
from flask import Flask, request, jsonify, render_template_string
from werkzeug.serving import make_server

# ══════════════════════════════════════════════════════════════════════════════
#  CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════

GPS_PORT, GPS_BAUD = "/dev/ttyAMA0", 9600
SIM_PORT, SIM_BAUD = "/dev/ttyAMA3", 9600
MPU_I2C_BUS, MPU_ADDRESS = 1, 0x68
PIN_BUZZER, PIN_BUTTON = 18, 27
PIN_SIM_DTR = 23  # SIM800L DTR pin for sleep control

# Crash thresholds - Y is vertical axis (gravity)
CRASH_THRESH_X, CRASH_THRESH_Y, CRASH_THRESH_Z = 0.3, 0.2, 0.3
# Other thresholds 
TURN_THRESH_X,  TURN_THRESH_Z = 0.15, 0.15  # Horizontal plane turns
BUMP_THRESH_Y    = 0.5  # Vertical axis bumps
POTHOLE_THRESH_Y = 0.7  # Vertical axis potholes

IMU_SAMPLE_RATE_HZ, CANCEL_WINDOW_S = 50, 15
SMS_MAX_RETRIES, SMS_RETRY_DELAY_S  = 3, 5

LOG_DIR, LOG_FILE = "/var/log/argus", "crash_only.log"
CONFIG_FILE       = "/home/argus/argus_config.json"
GPS_CACHE_FILE    = "/home/argus/gps_last_position.json"  # Persists GPS across reboots

DEVICE_ID    = "argus-v6"

HOTSPOT_SSID     = "ARGUS-Config"
HOTSPOT_PASSWORD = "argus1234"
HOTSPOT_CON_NAME = "Hotspot"
HOTSPOT_IFACE    = "wlan0"
HOTSPOT_PORT     = 8080

# GPS acquisition settings
GPS_FIX_WAIT_S        = 120   # max seconds to wait for first fix at startup
GPS_FIX_LOG_INTERVAL  = 10    # how often to log "still waiting" message
GPS_DROPOUT_TOLERANCE = 5     # consecutive bad sentences before marking invalid

# ══════════════════════════════════════════════════════════════════════════════
#  BUZZER PATTERNS
# ══════════════════════════════════════════════════════════════════════════════

BUZZER_PATTERNS = {
    "crash":       [(2000, 200, 200, -1)],
    "turn":        [(1000, 100,   0,  1)],
    "bump":        [( 800,  50,   0,  1)],
    "pothole":     [(1200, 150, 100,  2)],
    "config_mode": [(1500, 500, 500,  3)],
    "startup":     [(2500, 100, 100,  2)],
    "cancel":      [( 500, 1000,  0,  1)],
}

# ══════════════════════════════════════════════════════════════════════════════
#  Config Manager and Sample Config Layout
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_CONFIG = {
    "user_name":         "Vinay Konanpala",
    "user_age":          "25",
    "user_blood":        "B+",
    "user_vehicle":      "MH17AD2026",
    "user_conditions":   "None",
    "user_meds":         "None",
    "user_contact":      "9370741776",
    "emergency_numbers": ["+917821094156", "+919370741776"],    
    #Can be upto 5 Numbers
}

class ConfigManager:
    def __init__(self):
        self.config = self._load_config()

    def _load_config(self):
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r") as f:
                    return json.load(f)
            except Exception:
                log.warning("Failed to load config, using defaults")
        return DEFAULT_CONFIG.copy()

    def save_config(self, new_config):
        try:
            with open(CONFIG_FILE, "w") as f:
                json.dump(new_config, f, indent=2)
            self.config = new_config
            log.info("Config saved successfully")
            return True
        except Exception as e:
            log.error(f"Failed to save config: {e}")
            return False

    def get_config(self):
        return self.config.copy()

config_manager = ConfigManager()

# ══════════════════════════════════════════════════════════════════════════════
#  LOGGING
# ══════════════════════════════════════════════════════════════════════════════

def _setup_logging():
    os.makedirs(LOG_DIR, exist_ok=True)
    log = logging.getLogger("argus_crash")
    log.setLevel(logging.DEBUG)
    if not log.handlers:
        fmt = logging.Formatter(
            "%(asctime)s %(levelname)-8s %(message)s", "%Y-%m-%dT%H:%M:%S"
        )
        fh = logging.handlers.RotatingFileHandler(
            os.path.join(LOG_DIR, LOG_FILE), maxBytes=5*1024*1024, backupCount=3
        )
        fh.setLevel(logging.INFO)
        fh.setFormatter(fmt)
        log.addHandler(fh)
        ch = logging.StreamHandler()
        ch.setLevel(logging.INFO)
        ch.setFormatter(fmt)
        log.addHandler(ch)
    return log

log = _setup_logging()

# ══════════════════════════════════════════════════════════════════════════════
#  BUZZER
# ══════════════════════════════════════════════════════════════════════════════

class Buzzer:
    def __init__(self, pin):
        self.pin = pin
        GPIO.setup(pin, GPIO.OUT, initial=GPIO.LOW)
        self._pwm = GPIO.PWM(pin, 1000)
        self._pwm.start(0)
        self._stop_flag      = threading.Event()
        self._current_thread = None
        log.info("Buzzer initialized")

    def play_pattern(self, name):
        if name in BUZZER_PATTERNS:
            self.play(BUZZER_PATTERNS[name])
        else:
            log.warning(f"Unknown buzzer pattern: {name}")

    def play(self, pattern, duration_s=None):
        self._stop_flag.clear()
        def _run():
            start = time.monotonic()
            for freq, on, off, rep in pattern:
                c = 0
                while not self._stop_flag.is_set():
                    if duration_s and (time.monotonic() - start) >= duration_s:
                        break
                    self._pwm.ChangeFrequency(max(1, freq))
                    self._pwm.ChangeDutyCycle(50)
                    time.sleep(on / 1000.0)
                    self._pwm.ChangeDutyCycle(0)
                    if off > 0:
                        time.sleep(off / 1000.0)
                    c += 1
                    if rep != -1 and c >= rep:
                        break
                if self._stop_flag.is_set():
                    break
                if duration_s and (time.monotonic() - start) >= duration_s:
                    break
            self._pwm.ChangeDutyCycle(0)
        self._current_thread = threading.Thread(target=_run, daemon=True)
        self._current_thread.start()

    def stop(self):
        self._stop_flag.set()
        if self._current_thread:
            self._current_thread.join(timeout=0.5)
        self._pwm.ChangeDutyCycle(0)

    def cleanup(self):
        self.stop()
        self._pwm.stop()

# ══════════════════════════════════════════════════════════════════════════════
#  GPS STATE
# ══════════════════════════════════════════════════════════════════════════════

class _GpsState:
    def __init__(self):
        self._lock = threading.Lock()
        self.lat = self.lon = self.altitude = 0.0
        self.satellites = 0
        self.valid = False
        self.last_valid_lat = self.last_valid_lon = 0.0
        self.last_valid_altitude = 0.0
        self.last_valid_satellites = 0
        self.has_last_fix = False
        self._bad_count = 0  # consecutive bad sentences before marking invalid
        self._logged_fallback = False  # only warn once per dropout
        
        # Load persisted GPS position from previous boot
        self._load_cached_position()

    def _load_cached_position(self):
        """Load GPS position saved from previous boot"""
        try:
            if os.path.exists(GPS_CACHE_FILE):
                with open(GPS_CACHE_FILE, 'r') as f:
                    data = json.load(f)
                    self.last_valid_lat = data.get('lat', 0.0)
                    self.last_valid_lon = data.get('lon', 0.0)
                    self.last_valid_altitude = data.get('altitude', 0.0)
                    self.last_valid_satellites = data.get('satellites', 0)
                    # Only mark has_last_fix if we have valid coordinates
                    if self.last_valid_lat != 0.0 or self.last_valid_lon != 0.0:
                        self.has_last_fix = True
                        log.info(
                            f"Loaded cached GPS position: {self.last_valid_lat:.6f}, "
                            f"{self.last_valid_lon:.6f} (from previous boot)"
                        )
        except Exception as e:
            log.warning(f"Could not load cached GPS position: {e}")

    def _save_cached_position(self):
        """Save current GPS position to survive reboot"""
        try:
            data = {
                'lat': self.last_valid_lat,
                'lon': self.last_valid_lon,
                'altitude': self.last_valid_altitude,
                'satellites': self.last_valid_satellites,
                'timestamp': time.time()
            }
            with open(GPS_CACHE_FILE, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            log.debug(f"Could not save GPS cache: {e}")

    def update(self, lat, lon, altitude=0.0, satellites=0):
        with self._lock:
            self.lat, self.lon = lat, lon
            self.altitude, self.satellites = altitude, satellites
            self.valid = True
            self.last_valid_lat, self.last_valid_lon = lat, lon
            self.last_valid_altitude = altitude
            self.last_valid_satellites = satellites
            self.has_last_fix = True
            self._bad_count = 0
            self._logged_fallback = False  # reset so next dropout warns again
            
            # Save to disk for persistence across reboots
            self._save_cached_position()

    def mark_bad_sentence(self):
        # Only invalidate after GPS_DROPOUT_TOLERANCE consecutive bad sentences
        # so brief NEO-6M dropouts don't erase the last-known position
        with self._lock:
            self._bad_count += 1
            if self._bad_count >= GPS_DROPOUT_TOLERANCE:
                self.valid = False

    def snapshot(self):
        with self._lock:
            if self.valid:
                return self.lat, self.lon, self.altitude, self.satellites, True, False
            elif self.has_last_fix:
                if not self._logged_fallback:
                    log.warning("GPS fix lost — using last known position")
                    self._logged_fallback = True
                return (
                    self.last_valid_lat, self.last_valid_lon,
                    self.last_valid_altitude, self.last_valid_satellites,
                    True, True,
                )
            else:
                log.error("No GPS fix available and no previous fix in memory")
                return 0.0, 0.0, 0.0, 0, False, False

# Global GPS state
gps = _GpsState()

# Global SIM800L lock to prevent concurrent access
_sim800l_lock = threading.Lock()

# Global SIM800L modem instance (initialized in main)
_global_modem = None


def _nmea_coord(raw_str, hemi):
    """Convert NMEA ddmm.mmmmm to decimal degrees. Returns None on error."""
    try:
        raw = float(raw_str)
    except (ValueError, TypeError):
        return None
    degrees = int(raw // 100)
    decimal = degrees + (raw % 100) / 60.0
    if hemi in ("S", "W"):
        decimal = -decimal
    return decimal


def _gps_reader(stop_event):
    buffer = ""
    _first_fix = [False]   # mutable flag shared across reconnects
    while not stop_event.is_set():
        try:
            with serial.Serial(GPS_PORT, GPS_BAUD, timeout=2) as ser:
                log.info("GPS reader connected")
                buffer = ""
                while not stop_event.is_set():
                    if ser.in_waiting > 0:
                        try:
                            buffer += ser.read(ser.in_waiting).decode("ascii", errors="ignore")
                        except Exception as e:
                            log.debug(f"GPS read error: {e}")
                            continue

                        while "\n" in buffer:
                            line, buffer = buffer.split("\n", 1)
                            line = line.strip()
                            if not line:
                                continue

                            # GGA — primary fix source
                            if line.startswith(("$GPGGA", "$GNGGA")):
                                p = line.split(",")
                                if len(p) < 10:
                                    continue
                                if p[6] in ("", "0") or not p[2] or not p[4]:
                                    gps.mark_bad_sentence()
                                    continue
                                lat = _nmea_coord(p[2], p[3])
                                lon = _nmea_coord(p[4], p[5])
                                if lat is None or lon is None:
                                    gps.mark_bad_sentence()
                                    continue
                                try:
                                    altitude   = float(p[9]) if p[9] else 0.0
                                    satellites = int(p[7])   if p[7] else 0
                                except (ValueError, IndexError):
                                    altitude, satellites = 0.0, 0
                                gps.update(lat, lon, altitude, satellites)
                                if not _first_fix[0]:
                                    log.info(f"GPS fix acquired: {lat:.6f}, {lon:.6f}, Sats: {satellites}")
                                    _first_fix[0] = True

                            # RMC — fallback if GGA never yields a fix
                            elif line.startswith(("$GPRMC", "$GNRMC")):
                                p = line.split(",")
                                if len(p) < 7 or p[2] != "A" or not p[3] or not p[5]:
                                    continue
                                # Only use RMC when we have never had a fix from GGA
                                if not gps.has_last_fix:
                                    lat = _nmea_coord(p[3], p[4])
                                    lon = _nmea_coord(p[5], p[6])
                                    if lat is not None and lon is not None:
                                        gps.update(lat, lon, 0.0, 0)
                                        if not _first_fix[0]:
                                            log.info(f"GPS fix acquired (RMC): {lat:.6f}, {lon:.6f}")
                                            _first_fix[0] = True
                    else:
                        time.sleep(0.01)

        except Exception as e:
            log.error(f"GPS connection error: {e}")
            time.sleep(2)


# ══════════════════════════════════════════════════════════════════════════════
#  WIFI HOTSPOT MANAGER
# ══════════════════════════════════════════════════════════════════════════════

class HotspotManager:
    active_ip: str = ""

    @staticmethod
    def _run(cmd: list, timeout: int = 10) -> subprocess.CompletedProcess:
        full = ["sudo"] + cmd if cmd[0] != "sudo" else cmd
        result = subprocess.run(full, capture_output=True, text=True, timeout=timeout)
        if result.returncode != 0:
            log.warning(
                f"CMD [{' '.join(full)}] => rc={result.returncode} | "
                f"{result.stderr.strip() or result.stdout.strip()}"
            )
        return result

    @staticmethod
    def _wait_for_iface_state(iface: str, want: str, retries: int = 20) -> bool:
        for i in range(retries):
            try:
                out = subprocess.check_output(
                    ["sudo", "nmcli", "-t", "-f", "DEVICE,STATE", "device", "status"],
                    text=True, timeout=5,
                )
                for line in out.splitlines():
                    if line.startswith(f"{iface}:"):
                        state = line.split(":", 1)[1]
                        log.debug(f"[{i+1}/{retries}] {iface} → {state}")
                        if want in state:
                            return True
            except Exception as e:
                log.debug(f"State-poll error (attempt {i+1}): {e}")
            time.sleep(1)
        return False

    @staticmethod
    def _get_iface_ip(iface: str) -> str:
        try:
            out = subprocess.check_output(
                ["sudo", "ip", "-4", "addr", "show", iface],
                text=True, timeout=5,
            )
            for token in out.split():
                if "." in token and "/" in token:
                    return token.split("/")[0]
        except Exception:
            pass
        return ""

    @classmethod
    def enable(cls) -> bool:
        try:
            log.info("=" * 60)
            log.info("HotspotManager: starting enable sequence")
            log.info("=" * 60)

            log.info("Step 1: rfkill unblock wifi")
            r = cls._run(["rfkill", "unblock", "wifi"], timeout=5)
            if r.returncode != 0:
                log.error("rfkill unblock failed — cannot continue")
                return False

            log.info("Step 2: kill orphaned dnsmasq processes")
            cls._run(["pkill", "-f", "dnsmasq"], timeout=5)
            time.sleep(1)

            log.info("Step 3: cycle NetworkManager radio")
            cls._run(["nmcli", "radio", "wifi", "off"], timeout=5)
            time.sleep(3)
            cls._run(["nmcli", "radio", "wifi", "on"], timeout=5)
            time.sleep(3)

            log.info("Step 4: disconnect from any active WiFi networks")
            # Get list of active WiFi connections
            try:
                active_conns = subprocess.check_output(
                    ["sudo", "nmcli", "-t", "-f", "NAME,TYPE", "connection", "show", "--active"],
                    text=True, timeout=5
                ).strip()
                for line in active_conns.splitlines():
                    if "wireless" in line or "wifi" in line:
                        conn_name = line.split(":")[0]
                        log.info(f"Disconnecting from WiFi network: {conn_name}")
                        cls._run(["nmcli", "connection", "down", conn_name], timeout=5)
            except Exception as e:
                log.debug(f"Error disconnecting WiFi: {e}")

            log.info("Step 5: delete stale connection profiles")
            cls._run(["nmcli", "connection", "delete", HOTSPOT_CON_NAME], timeout=5)
            cls._run(["nmcli", "connection", "delete", HOTSPOT_SSID],     timeout=5)
            time.sleep(1)

            log.info("Step 6: disconnect wlan0")
            cls._run(["nmcli", "device", "disconnect", HOTSPOT_IFACE], timeout=5)
            time.sleep(2)

            log.info("Step 7: flush ghost IPs from wlan0")
            cls._run(["ip", "addr", "flush", "dev", HOTSPOT_IFACE], timeout=5)
            time.sleep(1)

            log.info("Step 8: waiting for wlan0 → disconnected")
            if not cls._wait_for_iface_state(HOTSPOT_IFACE, "disconnected", retries=20):
                log.error("wlan0 never reached 'disconnected' — aborting")
                return False
            log.info("wlan0 is ready")

            log.info("Step 9: create and activate hotspot")
            r = cls._run([
                "nmcli", "device", "wifi", "hotspot",
                "ifname",   HOTSPOT_IFACE,
                "con-name", HOTSPOT_CON_NAME,
                "ssid",     HOTSPOT_SSID,
                "password", HOTSPOT_PASSWORD,
                "band",     "bg",
                "channel",  "6",
            ], timeout=30)

            if r.returncode != 0:
                log.error(f"Hotspot creation failed: {r.stderr.strip()}")
                return False

            log.info("Step 10: waiting for wlan0 → connected")
            if not cls._wait_for_iface_state(HOTSPOT_IFACE, "connected", retries=20):
                log.error("Hotspot never reached 'connected' state — aborting")
                return False

            log.info("Step 11: disabling IPv6 on wlan0")
            cls._run(
                ["sysctl", "-w", f"net.ipv6.conf.{HOTSPOT_IFACE}.disable_ipv6=1"],
                timeout=5,
            )

            log.info("Step 12: discovering hotspot gateway IP")
            discovered_ip = ""
            for attempt in range(10):
                time.sleep(1)
                discovered_ip = cls._get_iface_ip(HOTSPOT_IFACE)
                if discovered_ip:
                    log.info(f"Gateway IP confirmed: {discovered_ip} (attempt {attempt+1})")
                    break
                log.debug(f"IP not yet assigned (attempt {attempt+1}/10)…")

            if not discovered_ip:
                log.warning("Could not discover gateway IP — falling back to 0.0.0.0")
                discovered_ip = "0.0.0.0"

            cls.active_ip = discovered_ip

            log.info("Step 13: confirming NM dnsmasq is running")
            try:
                ss_out = subprocess.check_output(
                    ["sudo", "ss", "-tulpn"], text=True, timeout=5
                )
                if "dnsmasq" in ss_out:
                    log.info("dnsmasq confirmed running — DHCP OK")
                else:
                    log.warning(
                        "dnsmasq NOT detected — clients will not receive IPs.\n"
                        "Fix: sudo systemctl disable --now dnsmasq && "
                        "sudo systemctl mask dnsmasq"
                    )
            except Exception as e:
                log.debug(f"dnsmasq check error: {e}")

            log.info("=" * 60)
            log.info("✓ HOTSPOT ACTIVE")
            log.info(f"  SSID     : {HOTSPOT_SSID}")
            log.info(f"  Password : {HOTSPOT_PASSWORD}")
            log.info(f"  Gateway  : {cls.active_ip}")
            log.info(f"  Web UI   : http://{cls.active_ip}:{HOTSPOT_PORT}")
            log.info("=" * 60)
            return True

        except subprocess.CalledProcessError as e:
            log.error(f"Subprocess error: {e} | stdout={e.output} | stderr={e.stderr}")
            return False
        except PermissionError as e:
            log.error(f"Permission denied — run with sudo: {e}")
            return False
        except Exception as e:
            import traceback
            log.error(f"Unexpected error in enable(): {e}\n{traceback.format_exc()}")
            return False

    @classmethod
    def disable(cls) -> bool:
        try:
            log.info("HotspotManager: disabling hotspot")
            cls._run(["nmcli", "connection", "down",   HOTSPOT_CON_NAME], timeout=10)
            time.sleep(1)
            cls._run(["nmcli", "connection", "delete", HOTSPOT_CON_NAME], timeout=10)
            time.sleep(1)
            cls._run(["pkill", "-f", "dnsmasq"], timeout=5)
            cls._run(["ip", "addr", "flush", "dev", HOTSPOT_IFACE],       timeout=5)
            cls.active_ip = ""
            
            # Reconnect to WiFi after disabling hotspot
            log.info("Attempting to reconnect to WiFi...")
            try:
                # Get list of saved WiFi connections (non-hotspot)
                saved_conns = subprocess.check_output(
                    ["sudo", "nmcli", "-t", "-f", "NAME,TYPE", "connection", "show"],
                    text=True, timeout=5
                ).strip()
                
                for line in saved_conns.splitlines():
                    if ("wireless" in line or "wifi" in line) and HOTSPOT_CON_NAME not in line:
                        conn_name = line.split(":")[0]
                        log.info(f"Reconnecting to WiFi network: {conn_name}")
                        cls._run(["nmcli", "connection", "up", conn_name], timeout=15)
                        time.sleep(2)
                        break
            except Exception as e:
                log.warning(f"Could not auto-reconnect to WiFi: {e}")
            
            log.info("✓ Hotspot disabled")
            return True
        except Exception as e:
            log.error(f"Error disabling hotspot: {e}")
            return False

    @classmethod
    def status(cls) -> bool:
        try:
            out = subprocess.check_output(
                ["sudo", "nmcli", "-t", "-f", "DEVICE,STATE,CONNECTION", "device"],
                text=True, timeout=5,
            )
            for line in out.splitlines():
                if line.startswith(f"{HOTSPOT_IFACE}:"):
                    parts = line.split(":")
                    state = parts[1] if len(parts) > 1 else ""
                    conn  = parts[2] if len(parts) > 2 else ""
                    is_up = (state == "connected" and conn == HOTSPOT_CON_NAME)
                    log.info(f"Hotspot status — state={state} conn={conn} active={is_up}")
                    return is_up
        except Exception as e:
            log.error(f"Status check failed: {e}")
        return False
    
# ══════════════════════════════════════════════════════════════════════════════
#  WEB CONFIG SERVER
# ══════════════════════════════════════════════════════════════════════════════

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ARGUS Configuration</title>
    <style>
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --primary: #e63946;
            --primary-dark: #c1121f;
            --surface: #ffffff;
            --bg: #f1f3f5;
            --text: #212529;
            --text-muted: #6c757d;
            --border: #dee2e6;
            --radius: 12px;
            --shadow: 0 4px 24px rgba(0,0,0,0.10);
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg);
            min-height: 100vh;
            padding: 24px 16px 48px;
            color: var(--text);
        }
        .page-header { text-align: center; margin-bottom: 28px; }
        .page-header .logo {
            display: inline-flex; align-items: center; justify-content: center;
            width: 64px; height: 64px;
            background: var(--primary); border-radius: 18px; margin-bottom: 14px;
            box-shadow: 0 4px 16px rgba(230,57,70,0.35);
        }
        .page-header .logo svg { width: 32px; height: 32px; fill: white; }
        .page-header h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }
        .page-header p  { color: var(--text-muted); font-size: 14px; margin-top: 4px; }
        .card {
            background: var(--surface); border-radius: var(--radius);
            box-shadow: var(--shadow); padding: 24px; margin-bottom: 16px;
        }
        .card-title {
            font-size: 13px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.8px; color: var(--primary); margin-bottom: 18px;
            display: flex; align-items: center; gap: 8px;
        }
        .card-title svg { width: 16px; height: 16px; fill: var(--primary); flex-shrink: 0; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 480px) { .form-row { grid-template-columns: 1fr; } }
        .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
        .form-group:last-child { margin-bottom: 0; }
        label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        input[type="text"], input[type="number"], input[type="tel"] {
            padding: 11px 14px; border: 1.5px solid var(--border); border-radius: 8px;
            font-size: 15px; color: var(--text); background: #fafafa;
            transition: border-color 0.2s, box-shadow 0.2s; width: 100%;
        }
        input:focus {
            outline: none; border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(230,57,70,0.12); background: white;
        }
        .contact-list { display: flex; flex-direction: column; gap: 10px; }
        .contact-entry {
            display: flex; align-items: center; gap: 10px;
            background: #fafafa; border: 1.5px solid var(--border);
            border-radius: 8px; padding: 10px 12px; transition: border-color 0.2s;
        }
        .contact-entry:focus-within {
            border-color: var(--primary); box-shadow: 0 0 0 3px rgba(230,57,70,0.10);
        }
        .contact-number {
            width: 24px; height: 24px; background: var(--primary); color: white;
            border-radius: 50%; font-size: 12px; font-weight: 700;
            display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .contact-entry input {
            border: none; background: transparent; padding: 0; font-size: 15px; flex: 1; min-width: 0;
        }
        .contact-entry input:focus { outline: none; box-shadow: none; }
        .btn-remove {
            background: none; border: none; cursor: pointer; color: #adb5bd;
            padding: 4px; border-radius: 6px; display: flex; align-items: center;
            transition: color 0.2s, background 0.2s; flex-shrink: 0;
        }
        .btn-remove:hover { color: var(--primary); background: rgba(230,57,70,0.08); }
        .btn-remove svg  { width: 16px; height: 16px; fill: currentColor; }
        .btn-remove.hidden { visibility: hidden; pointer-events: none; }
        .btn-add-contact {
            display: flex; align-items: center; justify-content: center; gap: 8px;
            width: 100%; padding: 10px; background: none;
            border: 1.5px dashed var(--border); border-radius: 8px;
            color: var(--text-muted); font-size: 14px; font-weight: 500;
            cursor: pointer; margin-top: 10px;
            transition: border-color 0.2s, color 0.2s, background 0.2s;
        }
        .btn-add-contact:hover:not(:disabled) {
            border-color: var(--primary); color: var(--primary); background: rgba(230,57,70,0.04);
        }
        .btn-add-contact:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-add-contact svg { width: 16px; height: 16px; fill: currentColor; }
        .contact-hint { font-size: 12px; color: var(--text-muted); margin-top: 8px; }
        .btn-save {
            width: 100%; padding: 15px; background: var(--primary); color: white;
            border: none; border-radius: var(--radius); font-size: 16px; font-weight: 700;
            cursor: pointer; letter-spacing: 0.3px;
            transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
            box-shadow: 0 4px 14px rgba(230,57,70,0.30); margin-top: 8px;
        }
        .btn-save:hover  { background: var(--primary-dark); box-shadow: 0 6px 18px rgba(230,57,70,0.38); }
        .btn-save:active { transform: scale(0.98); }
        .toast {
            position: fixed; bottom: 24px; left: 50%;
            transform: translateX(-50%) translateY(80px);
            background: #212529; color: white; padding: 12px 22px;
            border-radius: 100px; font-size: 14px; font-weight: 500;
            white-space: nowrap; box-shadow: 0 8px 24px rgba(0,0,0,0.20);
            transition: transform 0.35s cubic-bezier(.34,1.56,.64,1), opacity 0.3s;
            opacity: 0; z-index: 999;
        }
        .toast.show    { transform: translateX(-50%) translateY(0); opacity: 1; }
        .toast.success { background: #2b9348; }
        .toast.error   { background: #c1121f; }
    </style>
</head>
<body>

<div class="page-header">
    <div class="logo">
        <svg viewBox="0 0 24 24"><path d="M12 2L2 7v5c0 5.25 4.2 10.05 10 11 5.8-.95 10-5.75 10-11V7L12 2zm-1 13H9V9h2v6zm4 0h-2V9h2v6z"/></svg>
    </div>
    <h1>ARGUS</h1>
    <p>Crash Detection System — Configuration</p>
</div>

<div class="card">
    <div class="card-title">
        <svg viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
        Personal Information
    </div>
    <div class="form-row">
        <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="user_name" placeholder="e.g. Vinay Konanpala" required>
        </div>
        <div class="form-group">
            <label>Age</label>
            <input type="number" id="user_age" placeholder="25" required>
        </div>
    </div>
    <div class="form-row">
        <div class="form-group">
            <label>Blood Group</label>
            <input type="text" id="user_blood" placeholder="e.g. B+">
        </div>
        <div class="form-group">
            <label>Vehicle Registration</label>
            <input type="text" id="user_vehicle" placeholder="e.g. MH17AD2026">
        </div>
    </div>
</div>

<div class="card">
    <div class="card-title">
        <svg viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/></svg>
        Medical Information
    </div>
    <div class="form-group">
        <label>Medical Conditions</label>
        <input type="text" id="user_conditions" placeholder="e.g. Hypertension, Diabetes (or None)">
    </div>
    <div class="form-group">
        <label>Current Medications</label>
        <input type="text" id="user_meds" placeholder="e.g. Aspirin, Insulin (or None)">
    </div>
</div>

<div class="card">
    <div class="card-title">
        <svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
        Emergency Contacts
    </div>
    <div class="form-group">
        <label>Primary Contact Number</label>
        <input type="tel" id="user_contact" placeholder="e.g. 9370741776">
    </div>
    <div style="margin-top:18px">
        <label style="display:block;margin-bottom:10px">Alert Recipients (up to 5)</label>
        <div class="contact-list" id="contactList"></div>
        <button type="button" class="btn-add-contact" id="btnAddContact" onclick="addContact('')">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Add another contact
        </button>
        <p class="contact-hint">Include country code — e.g. +917821094156</p>
    </div>
</div>

<button class="btn-save" onclick="saveConfig()">Save Configuration</button>
<div class="toast" id="toast"></div>

<script>
const MAX_CONTACTS = 5;

function renderContacts(numbers) {
    document.getElementById('contactList').innerHTML = '';
    (numbers.length ? numbers : ['']).forEach(n => addContact(n, false));
    updateAddButton();
}

function addContact(value = '', focus = true) {
    const list = document.getElementById('contactList');
    if (list.children.length >= MAX_CONTACTS) return;
    const idx   = list.children.length + 1;
    const entry = document.createElement('div');
    entry.className = 'contact-entry';
    entry.innerHTML = `
        <div class="contact-number">${idx}</div>
        <input type="tel" placeholder="+91XXXXXXXXXX" value="${value}" oninput="renumberContacts()"/>
        <button type="button" class="btn-remove ${idx === 1 ? 'hidden' : ''}"
                onclick="removeContact(this)" title="Remove">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>`;
    list.appendChild(entry);
    updateAddButton();
    if (focus) entry.querySelector('input').focus();
}

function removeContact(btn) {
    btn.closest('.contact-entry').remove();
    renumberContacts();
    updateAddButton();
}

function renumberContacts() {
    document.querySelectorAll('.contact-entry').forEach((el, i) => {
        el.querySelector('.contact-number').textContent = i + 1;
        el.querySelector('.btn-remove').classList.toggle('hidden', i === 0);
    });
}

function updateAddButton() {
    document.getElementById('btnAddContact').disabled =
        document.getElementById('contactList').children.length >= MAX_CONTACTS;
}

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className   = `toast ${type} show`;
    setTimeout(() => { t.className = 'toast'; }, 3500);
}

function saveConfig() {
    const numbers = Array.from(
        document.querySelectorAll('#contactList input')
    ).map(i => i.value.trim()).filter(Boolean);

    if (!document.getElementById('user_name').value.trim()) {
        showToast('Please enter your full name', 'error'); return;
    }
    if (numbers.length === 0) {
        showToast('Add at least one emergency contact', 'error'); return;
    }

    const cfg = {
        user_name:         document.getElementById('user_name').value.trim(),
        user_age:          document.getElementById('user_age').value.trim(),
        user_blood:        document.getElementById('user_blood').value.trim(),
        user_vehicle:      document.getElementById('user_vehicle').value.trim(),
        user_conditions:   document.getElementById('user_conditions').value.trim() || 'None',
        user_meds:         document.getElementById('user_meds').value.trim()        || 'None',
        user_contact:      document.getElementById('user_contact').value.trim(),
        emergency_numbers: numbers,
    };

    fetch('/api/config', {
        method:  'POST',
        headers: {'Content-Type': 'application/json'},
        body:    JSON.stringify(cfg),
    })
    .then(r => r.json())
    .then(d => {
        if (d.status === 'success') {
            showToast('✓ Configuration saved! Closing config mode…', 'success');
        } else {
            showToast('Save failed — check logs', 'error');
        }
    })
    .catch(() => showToast('Network error — try again', 'error'));
}

fetch('/api/config').then(r => r.json()).then(data => {
    document.getElementById('user_name').value       = data.user_name       || '';
    document.getElementById('user_age').value        = data.user_age        || '';
    document.getElementById('user_blood').value      = data.user_blood      || '';
    document.getElementById('user_vehicle').value    = data.user_vehicle    || '';
    document.getElementById('user_conditions').value = data.user_conditions || '';
    document.getElementById('user_meds').value       = data.user_meds       || '';
    document.getElementById('user_contact').value    = data.user_contact    || '';
    renderContacts(data.emergency_numbers || []);
});
</script>
</body>
</html>
"""
    
class ConfigServer:
    def __init__(self, bind_ip: str = "0.0.0.0", port: int = HOTSPOT_PORT):
        self.bind_ip      = bind_ip
        self.port         = port
        self.app          = Flask(__name__)
        self.server       = None
        # Signal fired when user successfully saves config
        self.config_saved = threading.Event()
        self._setup_routes()

    def _setup_routes(self):
        @self.app.route("/")
        def index():
            return render_template_string(HTML_TEMPLATE)

        @self.app.route("/api/config", methods=["GET"])
        def get_config():
            return jsonify(config_manager.get_config())

        @self.app.route("/api/config", methods=["POST"])
        def save_config():
            try:
                if config_manager.save_config(request.json):
                    self.config_saved.set()   # ← wake up _config_mode immediately
                    return jsonify({"status": "success"})
                return jsonify({"status": "error"}), 500
            except Exception as e:
                log.error(f"Config save error: {e}")
                return jsonify({"status": "error", "message": str(e)}), 500

    def start(self):
        try:
            self.server = make_server(self.bind_ip, self.port, self.app, threaded=True)
            log.info(f"✓ Config server listening on http://{self.bind_ip}:{self.port}")
            self.server.serve_forever()
        except OSError as e:
            if "Address already in use" in str(e):
                log.error(f"Port {self.port} already in use.")
            else:
                log.error(f"ConfigServer OSError: {e}")
            raise
        except Exception as e:
            import traceback
            log.error(f"ConfigServer unexpected error: {e}\n{traceback.format_exc()}")
            raise

    def stop(self):
        if self.server:
            self.server.shutdown()
            log.info("Config server stopped")

# ══════════════════════════════════════════════════════════════════════════════
#  CONFIG MODE
# ══════════════════════════════════════════════════════════════════════════════

def _config_mode(buzzer):
    log.info("=== ENTERING CONFIG MODE ===")
    buzzer.play_pattern("config_mode")
    time.sleep(2)
    buzzer.stop()

    if not HotspotManager.enable():
        log.error("Failed to start hotspot — aborting config mode")
        return

    bind_ip = HotspotManager.active_ip or "0.0.0.0"
    server  = ConfigServer(bind_ip=bind_ip, port=HOTSPOT_PORT)

    server_errors = []
    def _start_server():
        try:
            server.start()
        except Exception as e:
            server_errors.append(e)
            log.error(f"ConfigServer thread crashed: {e}")

    server_thread = threading.Thread(target=_start_server, daemon=True)
    server_thread.start()
    time.sleep(3)

    if server_errors or not server_thread.is_alive():
        log.error("Config server failed to start — aborting config mode")
        HotspotManager.disable()
        return

    log.info(f"Config mode active — connect to '{HOTSPOT_SSID}' (pw: {HOTSPOT_PASSWORD})")
    log.info(f"Then open http://{bind_ip}:{HOTSPOT_PORT} in your browser")

    # Block here until user saves config OR 10-minute timeout
    saved = server.config_saved.wait(timeout=600)
    if saved:
        log.info("✓ Config saved by user — shutting down config mode")
    else:
        log.info("Config mode timed out after 10 minutes")

    # Brief pause so browser receives the HTTP response before server dies
    time.sleep(2)

    server.stop()
    HotspotManager.disable()
    log.info("=== EXITING CONFIG MODE ===")