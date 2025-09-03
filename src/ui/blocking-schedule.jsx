import './styles/blocking-schedule.css'
import { useState } from 'react';




const BlockingSchedule = function(){

    const [selectedBlockMode, setSelectedBlockMode] = useState('manual');


    const handleChange = function(event) {
        //setSelectedFruit(e.target.value);
        
        setSelectedBlockMode(event.target.value)
        console.log(`event value ${selectedBlockMode}`)
        console.log(`use state ${selectedBlockMode}`)
    };


    return (
        <div id="bs-root">
            <hr id='bs-divide'/>
            <div>

                <h3>When do you want to block distracting sites?</h3>
                <br />
                <div >
                    <input 
                    type="radio" 
                    name="block-mode" 
                    value="automatic" 
                    checked={selectedBlockMode === 'automatic'} 
                    onChange={handleChange} 
                    /> Automatically (until the end of the workday)
                    <small>
                    Block distracting sites until you finish your work/study. 
                    You'll get some free time before bed (check your socials guilt free!). 
                    When it's time to sleep, sites are blocked again.
                    </small>
                </div>
                <br />
                <div className='block-mode-radio'>
                    <input 
                    type="radio" 
                    name="block-mode" 
                    value="manual" 
                    checked={selectedBlockMode === 'manual'} 
                    onChange={handleChange} 
                    /> Manually (when i switch it on)
                    <small>Block distracting sites when you click the Start Focus Session button</small>
                </div>
                <br />
                <div className='block-mode-radio'>
                    <input 
                    type="radio" 
                    name="block-mode" 
                    value="advanced" 
                    checked={selectedBlockMode === 'advanced'} 
                    onChange={handleChange} 
                    /> Advanced (Customised blocking schedule)
                    <small>Coming Soon</small>
                </div>
              


            </div>
        </div>
 
 



    )



}


export default BlockingSchedule;