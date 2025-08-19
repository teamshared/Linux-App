import './App.css'
import FocusBearPage from './FocusBearPage'
let customMessage = "Hello from the rendere process"
import { useState, useEffect } from 'react';



function App() {
  const [urlList, seturlList] = useState('')
  const [savedMsg, setsavedMsg] = useState('')

  useEffect(function (){
    window.api.onReply(function (message){
      setsavedMsg(message)
    })
  }, [])
  

  function exportList(){
    console.log("export list")
    setsavedMsg("Saving...")
    window.api.exportList(urlList)
    seturlList('')
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

      </div>
      

      
    </>
  )
}

export default App
