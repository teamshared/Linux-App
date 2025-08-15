import React, {useState} from 'react';

const FocusBearPage = () => {

  const [greeting, setGreeting] = useState('');

  const showGreeting = () => {
    setGreeting('Hello! Welcome to Focus Bear');
  };

  return (
    <div className="container">
      <img
        src="https://focus-bear.github.io/assets/focus-blocked/images/FocusBearLogo.svg"
        alt="Focus Bear Logo"
        className="logo"
      />

      <h1 className="title">{greeting}</h1>
      {!greeting && (
        <button onClick={showGreeting} className="button">
          Show Greeting
        </button>
      )}
    </div>
  );
};

export default FocusBearPage;