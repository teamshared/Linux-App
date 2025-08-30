import React, { useState, useEffect } from 'react';

const Distracting_sites_page = function(){
    return (
        <section id="distracting-sites" style={{height: '70%', width: '80%', margin: '0 auto', marginTop: '100px', backgroundColor: 'grey'}}>

          <h1 style={{display: 'block', color: 'red', fontSize: '20px', top: '100px', marginTop: '100px'}}>Super Distracting Sites</h1>
          <br /><br />

          <p>
            Which sites do you waste time on? Focus Bear will help you be more intentional about how you use these sites.
            They will be blocked during focus sessions. The rest of the time, Focus Bear will ask you why you want to use the site.
          </p>
          <br /><br />

          <textarea style={{width: '80%', margin: '0 auto', height: '600px'}} name="" id=""></textarea>
          <br />
          <button>Add URL</button>
        </section>
    );
}
       
       
       
       
       



export default Distracting_sites_page;