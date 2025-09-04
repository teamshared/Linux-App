import React, { useState, useEffect } from 'react';
import './styles/Consistent-colors.css'
import './styles/distracting-sites.css'

const Distracting_sites_page = function(){
    return (
        <section id="distracting-sites" >

          <h1 style={{ fontSize: '1.1rem',}}>Super Distracting Sites</h1>
          <br />

          <p style={{fontSize: '0.8rem'}}>
            Which sites do you waste time on? Focus Bear will help you be more intentional about how you use these sites.
            They will be blocked during focus sessions. The rest of the time, Focus Bear will ask you why you want to use the site.
          </p>
          <br /><br />

          <textarea readOnly={true}className='textbox'></textarea>
          <br />

          <hr />
          <button id='url-button'className='ds-button'>Add URL</button>
          <button id='remove-button'className='ds-button'>Remove</button>
        </section>
    );
}
       
       
       
       
       



export default Distracting_sites_page;