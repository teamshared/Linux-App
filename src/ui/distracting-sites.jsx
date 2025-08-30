import React, { useState, useEffect } from 'react';
import './Consistent-colors.css'

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

          <textarea style={{width: '80%', margin: '0 auto', height: '300px'}} className='textbox'></textarea>
          <br />
          <button>Add URL</button>
        </section>
    );
}
       
       
       
       
       



export default Distracting_sites_page;