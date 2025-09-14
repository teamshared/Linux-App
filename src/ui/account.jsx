import { useState } from 'react';
import { authService } from '../services/auth.js';
import "./styles/account.css"

const AccountPage = function(){
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await authService.logout();
            // The logout method will redirect to Auth0 logout, which will then redirect back to your app
            // Your App.jsx will detect no user and show the login screen
        } catch (error) {
            console.error('Logout failed:', error);
            setIsLoggingOut(false);
        }
    };

    return (
        <div id="acc-root">
            <hr id='acc-divide'/>
            <div id="account-root">
                <button 
                    id='logout-button' 
                    className='acc-button' 
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                >
                    {isLoggingOut ? 'Logging out...' : 'Logout?'}
                </button>
            </div>
        </div>
    )
}

export default AccountPage;