## Project-Group-3---AR-573
Focus Bear Linux Distraction Blocker

### Documentation

Refer to word docs and [this video](https://drive.google.com/file/d/1Af-z7W5sLIHynJB9LSC3MY7zyKFEmIZy/view?usp=sharing) for an overview.

### Secrets

In github repo secrets

### Dev Commands
### npm run start:prod
start application in production mode

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
- Node js, At Least Node Js version 20 so its Vite Compatible Can be installed from the Node Js Official Website 
- npm (Node Package Manager): Should be at least version 10.0.0 should be isntalled when you install nodejs 
- Python3: Should be at least version 3.8 can be installed with the following command “sudo apt install python3 -y” 
- MitmProxy: The main proxy application used for the blocking mechanism 
- build-essential 
- libgtk-3-0 
- libnotify4  
- libnss3  
- libxss1  
- libxtst6  
- xdg-utils  
- libatspi2.0-0  
- libsecret-1-0  
