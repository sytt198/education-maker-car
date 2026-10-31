import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './education/App.jsx';
import './education/styles.css';
import './education/layout.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
