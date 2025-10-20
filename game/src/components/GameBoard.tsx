import './GameBoard.css';

type Coordinate = {
  x: number;
  y: number;
};

interface GameBoardProps {
  gridSize: number;
  playerPosition: Coordinate | null;
}

export function GameBoard({ gridSize, playerPosition }: GameBoardProps) {
  const rows = [];

  for (let row = gridSize; row >= 1; row -= 1) {
    const cells = [];
    for (let column = 1; column <= gridSize; column += 1) {
      const isPlayer = playerPosition?.x === column && playerPosition?.y === row;
      cells.push(
        <div
          key={`${column}-${row}`}
          className={`cell ${isPlayer ? 'player-cell' : ''}`}
        >
          {isPlayer ? '•' : ''}
        </div>
      );
    }

    rows.push(
      <div key={row} className="board-row">
        <span className="axis-label">{row}</span>
        <div className="row-cells">{cells}</div>
      </div>
    );
  }

  const axisLabels = [
    <span key="blank" className="axis-label" />,
  ];
  for (let column = 1; column <= gridSize; column += 1) {
    axisLabels.push(
      <span key={column} className="axis-label">
        {column}
      </span>
    );
  }

  return (
    <div className="board-container">
      <div className="board-grid">{rows}</div>
      <div className="board-axis">{axisLabels}</div>
    </div>
  );
}
