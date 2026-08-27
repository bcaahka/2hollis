import './Cover.css';

interface CoverProps {
  album: string;
  year: number;
  cover?: string;
  playing?: boolean;
}

const Cover: React.FC<CoverProps> = ({ album, year, cover, playing = false }) => {
  if (cover) {
    return (
      <div className={`cover cover-img-wrap${playing ? ' playing' : ''}`}>
        <div className="cover-motion">
          <img className="cover-img" src={cover} alt={`${album} cover`} />
        </div>
      </div>
    );
  }

  return (
    <div className={`cover${playing ? ' playing' : ''}`}>
      <span className="cover-logo">2HOLLIS</span>
      <span className="cover-year">{year}</span>
      <span className="cover-letter">{album.charAt(0)}</span>
      <span className="cover-album">{album}</span>
    </div>
  );
};

export default Cover;
