import React from 'react';
import { createRoot } from 'react-dom/client';
import { FileRouter } from './kit';
import { App } from './App';
import './style.css';
import './kit.css';

createRoot(document.getElementById('root')!).render(<FileRouter><App /></FileRouter>);
