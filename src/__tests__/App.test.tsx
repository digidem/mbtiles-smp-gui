import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import App from '../renderer/App';

// Mock the electron object
window.electron = {
  ipcRenderer: {
    sendMessage: jest.fn(),
    on: jest.fn().mockReturnValue(jest.fn()), // Return a cleanup function
    once: jest.fn(),
  },
};

describe('App', () => {
  it('should render', () => {
    expect(render(<App />)).toBeTruthy();
  });
});
