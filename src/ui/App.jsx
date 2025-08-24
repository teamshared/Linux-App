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

  // Triggers the focus session toggle (start or stop)
  function focusSession(){
    window.api.startFocusSession();
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

      </div>
      

      
    </>
  )
}

export default App
