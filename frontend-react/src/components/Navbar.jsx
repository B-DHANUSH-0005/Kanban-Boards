import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const { isAuthenticated, username, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAuthenticated) return null;

  const isBoardPage = location.pathname.startsWith('/board/');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar" id="main-navbar">
      <Link to="/" className="navbar-brand">
        <span className="navbar-title">KANBOARDS</span>
      </Link>
      <div className="navbar-actions">
        <span className="user-email hide-on-small">Hi, {username}</span>
        {isBoardPage ? (
          <button 
            className="btn btn-outline" 
            onClick={() => navigate('/')}
          >
            ← Back to Boards
          </button>
        ) : (
          <button 
            className="btn btn-primary" 
            onClick={() => window.dispatchEvent(new Event('open-create-board-modal'))}
          >
            + New Board
          </button>
        )}
        <button className="btn btn-outline btn-logout" onClick={handleLogout} id="logout-btn">
          Logout
        </button>
      </div>
    </nav>
  );
}
