Argus is an AI intellegent navigation system, which uses real time data fetched from our own number plate IOT sensor installed on motorcycles

The Argus Project:

Hardware Connections :-
## Complete hardware wiring — Pi 4B pinout

```
Pi 4B 40-pin header
───────────────────────────────────────────────────────────────────
Physical  BCM    Signal          Connected to       Notes
Pin  1    3.3V   3.3V power      MPU-6050 VCC
Pin  2    5V     5V power        NEO-6M VCC
Pin  3    GPIO2  I2C1 SDA        MPU-6050 SDA       
Pin  5    GPIO3  I2C1 SCL        MPU-6050 SCL       
Pin  6    GND    Ground          MPU-6050 GND
Pin  7    GPIO4  UART3 TX        SIM800L RX          dtoverlay=uart3
Pin  8    GPIO14 UART0 TX        NEO-6M  RX          
Pin  9    GND    Ground          NEO-6M  GND
Pin 10    GPIO15 UART0 RX        NEO-6M  TX
Pin 11    GPIO17 Button input    Button → GND       
Pin 12    GPIO18 PWM0 Buzzer     Buzzer +           buzzer – to BC547
Pin 14    GND    Ground          Buzzer –
Pin 20    GND    Ground          SIM800L GND
Pin 29    GPIO5  UART3 RX        SIM800L TX          dtoverlay=uart3
Pin 39    GND    Ground          Button common GND
CSI       —      Camera ribbon   Pi Cam Rev 1.3     15-pin FFC
───────────────────────────────────────────────────────────────────
```