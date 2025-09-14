## Project-Group-3---AR-573
Focus Bear Linux Distraction Blocker

<<<<<<< HEAD
=======
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

4. Run the demo app and input domains and keywords
- npm run dev:e
- input domains you want to block e.g., facebook.com, honey.nine.com.au and click 'Export (sub)domains to .txt.
- input keywords you want to block e.g., games, social, news and click 'Export keywords to .txt'

5. running the keyword blocker
1. click 'Start Focus Session'
- It will Run the script:
- mitmdump -s mitmproxy_blocker.py
3. Now try visiting the blocked websites
- Visit any site containing your domains and keywords in the URL — it should display the FocusBear blocked page.

Stopping blocker.
- click 'Stop Focus Session'
- Remove proxy settings to return to normal browsing


### Dependencies
#### For URL Grabbing
System Tools:

wmctrl - Lists all windows and their titles
xprop - Gets detailed window properties (full titles)


>>>>>>> 3e13cbe980ce05f3c58839d02ca170ba3b1f3848

