## Project-Group-3---AR-573
Focus Bear Linux Distraction Blocker


## Main

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
- in browser or system proxy settings, manually set proxy: 127.0.0.1, port: 8080
- open browser and go to http://mitm.it
- Download and install the certificate for linux.

3. import certificate to your browser
- Certifcate settings, import, and select certificate file.

4. Run the demo app and input domains and keywords
- npm run start
- input domains you want to block e.g., facebook.com, honey.nine.com.au and click 'Export (sub)domains to .txt.
- input keywords you want to block e.g., games, social, news and click 'Export keywords to .txt'

5. running the keyword and domain blocker
1. click 'Start Focus Session'
- It will set the system proxy then run the script:
- mitmdump -s mitmproxy_blocker.py
3. Now try visiting the blocked websites
- Visit any site containing your domains and keywords in the URL — it should display the FocusBear blocked page.

Stopping blocker.
- click 'Stop Focus Session'
- It will restore system proxy to default allowing for normal browsing.


### Dependencies
#### For URL Grabbing
System Tools:

wmctrl - Lists all windows and their titles
xprop - Gets detailed window properties (full titles)



