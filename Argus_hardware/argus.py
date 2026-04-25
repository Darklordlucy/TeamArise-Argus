
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


