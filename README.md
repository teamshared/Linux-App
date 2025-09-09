## Project-Group-3---AR-573
Focus Bear Linux Distraction Blocker

## Branch for development of the Blocking Mechanism

### Dev Commands
#### npm run dev:e
start electron app

#### npm run dev:r
start react app

#### mitmproxy
prerequisites:
1. install mitmproxy
sudo apt update
sudo apt install mitmproxy

2. Install mitmproxy CA certificate
- run mitmproxy in cli with 'mitmproxy'
- open browser and go to http://mitm.it
- Download and install the certificate.

3. Set your browser to use the proxy and certificate
- Proxy: 127.0.0.1
- Port: 8080
- Certifcate settings, import, and select certificate file.

4. Ensure there is keyword file at /tmp/focusbear-keywords.txt with keywords to be blocked
- Keyword per line (e.g., news, social, gaming)
- Can do it manually or use the added export keywords to .txt button in electron gui

5. runing the keyword blocker
1. Navigate to python directory
2. Run the script
- mitmdump -s mitmproxy_blocker.py
3. Keep this terminal running while testing
- Visit any site containing your keywords in the URL — it should display the FocusBear blocked page.

Stopping blocker.
- CTRL + C to stop
- Remove proxy settings to return to normal browsing


### Dependencies
#### For URL Grabbing
System Tools:

wmctrl - Lists all windows and their titles
xprop - Gets detailed window properties (full titles)



