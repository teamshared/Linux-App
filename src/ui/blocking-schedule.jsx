import './styles/blocking-schedule.css'
import { useSyncedState } from '../services/sync';

const BlockingSchedule = function(){
  const [selectedBlockMode, setSelectedBlockMode, isLoading] = useSyncedState('selectedBlockMode');

  const handleChange = function(event) {
    const newValue = event.target.value;
    setSelectedBlockMode(newValue);
    console.log(`Block mode changed to: ${newValue}`);
  };

  if (isLoading) {
    return (
      <div id="bs-root">
        <hr id='bs-divide'/>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div>Loading blocking schedule...</div>
        </div>
      </div>
    );
  }

  return (
    <div id="bs-root">
      <hr id='bs-divide'/>
      <div id="blockmodes-root">
        <h3>When do you want to block distracting sites?</h3>
        <br />
        <div>
          <input
            type="radio"
            name="block-mode"
            value="automatic"
            checked={selectedBlockMode === 'automatic'}
            onChange={handleChange}
          /> Automatically (until the end of the workday)
        </div>
        <small>
          Block distracting sites until you finish your work/study.
          You'll get some free time before bed (check your socials guilt free!).
          When it's time to sleep, sites are blocked again.
        </small>
        <br />
        <div className='block-mode-radio'>
          <input
            type="radio"
            name="block-mode"
            value="manual"
            checked={selectedBlockMode === 'manual'}
            onChange={handleChange}
          /> Manually (when i switch it on)
        </div>
        <small>Block distracting sites when you click the Start Focus Session button</small>
        <br />
        <div className='block-mode-radio'>
          <input
            type="radio"
            name="block-mode"
            value="advanced"
            checked={selectedBlockMode === 'advanced'}
            onChange={handleChange}
          /> Advanced (Customised blocking schedule)
        </div>
        <small>Coming Soon</small>
      </div>
    </div>
  )
}

export default BlockingSchedule;