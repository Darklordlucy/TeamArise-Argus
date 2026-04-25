
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
import subprocess
import json
import serial
import time
import os

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