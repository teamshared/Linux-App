import { useState } from 'react';
import { nativeAuthService } from '../services/nativeAuth.js';
import "./styles/account.css"

const AccountPage = function(){
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await nativeAuthService.logout();
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