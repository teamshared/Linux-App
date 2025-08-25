import './App.css'
import FocusBearPage from './FocusBearPage'
let customMessage = "Hello from the rendere process"

import { useState, useEffect } from 'react';



function App() {
  const [urlList, seturlList] = useState('')
  const [savedMsg, setsavedMsg] = useState('')
  const [focusState, setfocusState] = useState(false)

  useEffect(function (){
    window.api.onReply(function (message){
      setsavedMsg(message)
    })
    // Listen for focus session results (block or unblock)
    // Toggles the button label based on success feedback from main process
    window.api.onFocusSessionResult((message) => {
      setsavedMsg(message)
      setfocusState((prev) => !prev); // Toggle focus state (ON ↔ OFF)
    });
  }, []);


  function exportList(){
    console.log("export list")
    setsavedMsg("Saving...")
    window.api.exportList(urlList)
    seturlList('')
  }

  function focusSession(){
    window.api.startFocusSession();
  }

  async function grabCurrentUrl() {
    try {
      setsavedMsg("Grabbing URL...");
      const result = await window.api.grabCurrentUrl();
      if (result) {
        setsavedMsg(`Found URL: ${result.url}`);
        seturlList(prev => prev ? `${prev}\n${result.url}` : result.url);
      } else {
        setsavedMsg("No URL found");
      }
    } catch (error) {
      setsavedMsg(`Error: ${error.message}`);
    }
  }

  async function grabAllUrls() {
    try {
      setsavedMsg("Grabbing all URLs...");
      const results = await window.api.grabAllUrls();
      if (results.length > 0) {
        const urls = results.map(r => r.url).join('\n');
        seturlList(urls);
        setsavedMsg(`Found ${results.length} URLs`);
      } else {
        setsavedMsg("No URLs found");
      }
    } catch (error) {
      setsavedMsg(`Error: ${error.message}`);
    }
  }


  return (
    <>
      {/* <FocusBearPage></FocusBearPage> */}
      <div>
        <h1 id="errormsg">{savedMsg}</h1>
      </div>
      <div className="container">
        <img
          src="https://focus-bear.github.io/assets/focus-blocked/images/FocusBearLogo.svg"
          alt="Focus Bear Logo"
          className="logo"
        />
        <h1 className="title">Hello! Welcome to Focus Bear</h1>
      </div>

      <div className="textBoxContainer">
        <div>
          {/* <textarea  text></textarea> */}
          <textarea 
            id='urls'
            type="text" 
            value={urlList}
            onChange={function (e) 
              {seturlList(e.target.value)}
            }
          />
        </div>
        

        <button onClick={exportList}>
          Export to txt
        </button>

        {/* Button text changes dynamically based on focusState */}
        <button id="focus-state" onClick={focusSession}>
          {focusState ? "Stop Focus Session" : "Start Focus Session"}
        </button>

        <button onClick={grabCurrentUrl}>
          Grab Current URL
        </button>

        <button onClick={grabAllUrls}>
          Grab All URLs
        </button>

      </div>
      

      
    </>
  )
}

export default App
