import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Upload from './components/Upload';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Upload />} />
      </Routes>
    </Router>
  );
}
