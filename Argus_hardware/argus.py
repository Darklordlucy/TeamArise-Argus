
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                ARGUS — Crash Detection with Web Config                       ║
║                               Team Arise                                     ║
║           Features: SMS Alert , HTTPS post , LOGS reporting                  ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

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
#  Sample Config Layout
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

