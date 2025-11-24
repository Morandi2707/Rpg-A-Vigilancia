import React, { useState, useEffect, useRef } from 'react';
import { Users, Upload, Download, Settings, Plus, Trash2, AlertCircle, Skull, Brain, Droplet } from 'lucide-react';

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * Ordem Paranormal RPG
 *
 * Componente principal do jogo de RPG de mesa Ordem Paranormal.
 *
 * Renderiza a interface de login, onde o usuario pode escolher entre entrar como Mestre ou Jogador.
 * Após o login, renderiza o painel de controle do Mestre ou a HUD do Jogador.
 *
 * @returns {JSX.Element} O componente principal do jogo.
 */
/*******  d3d2504f-7199-413b-aa1f-83165c4ae757  *******/
const OrdemParanormalRPG = () => {
  const [isGM, setIsGM] = useState(null);
  const [nickname, setNickname] = useState('');
  const [sessionId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [gameState, setGameState] = useState({
    map: null,
    tokens: [],
    players: []
  });
  const [selectedToken, setSelectedToken] = useState(null);
  const [showGMPanel, setShowGMPanel] = useState(false);
  const [draggedToken, setDraggedToken] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const mapRef = useRef(null);

  const conditions = [
    { id: 'bleeding', label: 'Sangrando', icon: '🩸', color: '#ef4444' },
    { id: 'stunned', label: 'Atordoado', icon: '💫', color: '#f59e0b' },
    { id: 'fear', label: 'Medo', icon: '😱', color: '#8b5cf6' },
    { id: 'madness', label: 'Loucura', icon: '🌀', color: '#ec4899' }
  ];

  // Sistema de sincronização
  useEffect(() => {
    const savedState = localStorage.getItem(`rpg-session-${sessionId}`);
    if (savedState) {
      setGameState(JSON.parse(savedState));
    }

    const interval = setInterval(() => {
      const currentState = localStorage.getItem(`rpg-session-${sessionId}`);
      if (currentState) {
        const parsed = JSON.parse(currentState);
        setGameState(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(parsed)) {
            return parsed;
          }
          return prev;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionId]);

  const syncState = (newState) => {
    setGameState(newState);
    localStorage.setItem(`rpg-session-${sessionId}`, JSON.stringify(newState));
  };

  const handleLogin = (asGM) => {
    if (!nickname.trim()) return;
    setIsGM(asGM);
    
    if (!asGM) {
      const existingPlayer = gameState.players.find(p => p.name === nickname);
      if (!existingPlayer) {
        const newPlayer = {
          id: Math.random().toString(36).substr(2, 9),
          name: nickname,
          avatar: '🎭',
          pv: { current: 20, max: 20 },
          pd: { current: 5, max: 5 },
          san: { current: 100, max: 100 },
          conditions: []
        };
        syncState({
          ...gameState,
          players: [...gameState.players, newPlayer]
        });
      }
    }
  };

  const handleMapUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        syncState({ ...gameState, map: event.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const addToken = (type) => {
    const newToken = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      name: type === 'player' ? 'Jogador' : 'Monstro',
      x: 50,
      y: 50,
      size: 60,
      pv: { current: 20, max: 20 },
      conditions: []
    };
    syncState({ ...gameState, tokens: [...gameState.tokens, newToken] });
  };

  const updateToken = (id, updates) => {
    syncState({
      ...gameState,
      tokens: gameState.tokens.map(t => t.id === id ? { ...t, ...updates } : t)
    });
  };

  const deleteToken = (id) => {
    syncState({
      ...gameState,
      tokens: gameState.tokens.filter(t => t.id !== id)
    });
  };

  const updatePlayer = (id, updates) => {
    const oldState = JSON.parse(JSON.stringify(gameState));
    const newState = {
      ...gameState,
      players: gameState.players.map(p => p.id === id ? { ...p, ...updates } : p)
    };
    
    if (isGM) {
      setUndoStack([...undoStack, { state: oldState, timestamp: Date.now() }]);
      setTimeout(() => {
        setUndoStack(prev => prev.filter(u => Date.now() - u.timestamp < 10000));
      }, 10000);
    }
    
    syncState(newState);
  };

  const undo = () => {
    if (undoStack.length > 0) {
      const last = undoStack[undoStack.length - 1];
      syncState(last.state);
      setUndoStack(undoStack.slice(0, -1));
    }
  };

  const handleTokenDragStart = (token, e) => {
    setDraggedToken(token);
  };

  const handleMapDrop = (e) => {
    e.preventDefault();
    if (!draggedToken || !mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    updateToken(draggedToken.id, { x, y });
    setDraggedToken(null);
  };

  const exportSession = () => {
    const data = JSON.stringify(gameState, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ordem-paranormal-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importSession = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          syncState(data);
        } catch (err) {
          alert('Erro ao importar sessão');
        }
      };
      reader.readAsText(file);
    }
  };

  const adjustStat = (playerId, stat, amount) => {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    const newValue = Math.max(0, Math.min(player[stat].max, player[stat].current + amount));
    updatePlayer(playerId, {
      [stat]: { ...player[stat], current: newValue }
    });
  };

  const StatBar = ({ label, current, max, color, playerId, stat, icon: Icon }) => {
    const percentage = (current / max) * 100;
    const currentPlayer = gameState.players.find(p => p.name === nickname);
    const isOwner = currentPlayer?.id === playerId;
    const canEdit = isOwner || isGM;

    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon size={18} color={color} />
            <span className="font-bold text-sm">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    adjustStat(playerId, stat, -5);
                  }} 
                  className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                >
                  -5
                </button>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    adjustStat(playerId, stat, -1);
                  }} 
                  className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                >
                  -1
                </button>
              </>
            )}
            <input
              type="number"
              value={current}
              onChange={(e) => {
                if (!canEdit) return;
                const val = parseInt(e.target.value) || 0;
                updatePlayer(playerId, {
                  [stat]: { current: Math.max(0, Math.min(max, val)), max }
                });
              }}
              className="w-16 px-2 py-1 border rounded text-center text-sm bg-gray-700 text-white border-gray-600"
              disabled={!canEdit}
            />
            <span className="text-sm text-gray-400">/ {max}</span>
            {canEdit && (
              <>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    adjustStat(playerId, stat, 1);
                  }} 
                  className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                >
                  +1
                </button>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    adjustStat(playerId, stat, 5);
                  }} 
                  className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                >
                  +5
                </button>
              </>
            )}
          </div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-6 overflow-hidden relative">
          <div
            className="h-full transition-all duration-500 ease-out flex items-center justify-center text-white text-xs font-bold"
            style={{
              width: `${percentage}%`,
              backgroundColor: color
            }}
          >
            {percentage > 20 && `${Math.round(percentage)}%`}
          </div>
        </div>
      </div>
    );
  };

  // Tela de Login
  if (isGM === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-2xl border border-purple-500">
          <h1 className="text-3xl font-bold text-white mb-6 text-center">Ordem Paranormal</h1>
          <input
            type="text"
            placeholder="Seu nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full px-4 py-3 rounded bg-gray-700 text-white border border-gray-600 mb-4"
          />
          <div className="space-y-3">
            <button
              onClick={() => handleLogin(true)}
              className="w-full px-6 py-3 bg-purple-600 text-white rounded font-bold hover:bg-purple-700 transition"
            >
              Entrar como Mestre
            </button>
            <button
              onClick={() => handleLogin(false)}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition"
            >
              Entrar como Jogador
            </button>
          </div>
          <p className="text-gray-400 text-sm mt-4 text-center">Sessão: {sessionId}</p>
        </div>
      </div>
    );
  }

  const currentPlayer = gameState.players.find(p => p.name === nickname);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Ordem Paranormal - {isGM ? 'Mestre' : nickname}</h1>
        <div className="flex gap-2">
          {isGM && (
            <>
              <button onClick={() => setShowGMPanel(!showGMPanel)} className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700 flex items-center gap-2">
                <Settings size={18} />
                Painel do Mestre
              </button>
              <label className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 cursor-pointer flex items-center gap-2">
                <Upload size={18} />
                Upload Mapa
                <input type="file" accept="image/*" onChange={handleMapUpload} className="hidden" />
              </label>
            </>
          )}
          <button onClick={exportSession} className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 flex items-center gap-2">
            <Download size={18} />
            Export
          </button>
          {isGM && (
            <label className="px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-700 cursor-pointer flex items-center gap-2">
              <Upload size={18} />
              Import
              <input type="file" accept=".json" onChange={importSession} className="hidden" />
            </label>
          )}
          {isGM && undoStack.length > 0 && (
            <button onClick={undo} className="px-4 py-2 bg-red-600 rounded hover:bg-red-700">
              Desfazer ({undoStack.length})
            </button>
          )}
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Mapa Central */}
        <div className="flex-1 relative bg-gray-800">
          <div
            ref={mapRef}
            className="w-full h-full relative"
            onDrop={handleMapDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{
              backgroundImage: gameState.map ? `url(${gameState.map})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {!gameState.map && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="text-xl mb-2">Nenhum mapa carregado</p>
                  {isGM && <p className="text-sm">Use "Upload Mapa" para começar</p>}
                </div>
              </div>
            )}

            {/* Tokens */}
            {gameState.tokens.map(token => (
              <div
                key={token.id}
                draggable={isGM}
                onDragStart={(e) => handleTokenDragStart(token, e)}
                onClick={() => setSelectedToken(token)}
                className="absolute cursor-pointer transition-transform hover:scale-110"
                style={{
                  left: `${token.x}%`,
                  top: `${token.y}%`,
                  width: `${token.size}px`,
                  height: `${token.size}px`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className={`w-full h-full rounded-full border-4 flex items-center justify-center text-2xl ${
                  token.type === 'player' ? 'bg-blue-500 border-blue-300' : 'bg-red-500 border-red-300'
                }`}>
                  {token.type === 'player' ? '🎭' : '👹'}
                </div>
                {token.conditions.length > 0 && (
                  <div className="absolute -top-2 -right-2 flex gap-1">
                    {token.conditions.map(cond => {
                      const condition = conditions.find(c => c.id === cond);
                      return condition ? (
                        <span key={cond} className="text-xl">{condition.icon}</span>
                      ) : null;
                    })}
                  </div>
                )}
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs whitespace-nowrap">
                  {token.name} ({token.pv.current}/{token.pv.max})
                </div>
              </div>
            ))}

            {/* Token Detail Card */}
            {selectedToken && (
              <div className="absolute top-4 right-4 bg-gray-800 border border-gray-600 rounded-lg p-4 w-64 shadow-xl">
                <div className="flex justify-between items-start mb-3">
                  <input
                    type="text"
                    value={selectedToken.name}
                    onChange={(e) => updateToken(selectedToken.id, { name: e.target.value })}
                    className="font-bold text-lg bg-transparent border-b border-gray-600 outline-none"
                    disabled={!isGM}
                  />
                  <button onClick={() => setSelectedToken(null)} className="text-gray-400 hover:text-white">✕</button>
                </div>
                
                <div className="mb-3">
                  <label className="text-sm text-gray-400">PV</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={selectedToken.pv.current}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        updateToken(selectedToken.id, {
                          pv: { ...selectedToken.pv, current: Math.max(0, Math.min(selectedToken.pv.max, val)) }
                        });
                      }}
                      className="w-16 px-2 py-1 bg-gray-700 rounded text-center"
                      disabled={!isGM}
                    />
                    <span>/</span>
                    <input
                      type="number"
                      value={selectedToken.pv.max}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        updateToken(selectedToken.id, {
                          pv: { ...selectedToken.pv, max: Math.max(1, val) }
                        });
                      }}
                      className="w-16 px-2 py-1 bg-gray-700 rounded text-center"
                      disabled={!isGM}
                    />
                  </div>
                </div>

                {isGM && (
                  <>
                    <div className="mb-3">
                      <label className="text-sm text-gray-400">Tamanho</label>
                      <input
                        type="range"
                        min="40"
                        max="120"
                        value={selectedToken.size}
                        onChange={(e) => updateToken(selectedToken.id, { size: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="text-sm text-gray-400 block mb-2">Condições</label>
                      <div className="flex flex-wrap gap-2">
                        {conditions.map(cond => (
                          <button
                            key={cond.id}
                            onClick={() => {
                              const hasCondition = selectedToken.conditions.includes(cond.id);
                              updateToken(selectedToken.id, {
                                conditions: hasCondition
                                  ? selectedToken.conditions.filter(c => c !== cond.id)
                                  : [...selectedToken.conditions, cond.id]
                              });
                            }}
                            className={`px-2 py-1 rounded text-xs ${
                              selectedToken.conditions.includes(cond.id)
                                ? 'bg-opacity-100'
                                : 'bg-opacity-30'
                            }`}
                            style={{ backgroundColor: cond.color }}
                          >
                            {cond.icon} {cond.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        deleteToken(selectedToken.id);
                        setSelectedToken(null);
                      }}
                      className="w-full px-3 py-2 bg-red-600 rounded hover:bg-red-700 flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} />
                      Remover Token
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* HUD do Jogador */}
        {!isGM && currentPlayer && (
          <div className="w-96 bg-gray-800 border-l border-gray-700 p-6 overflow-y-auto">
            <div className="text-center mb-6">
              <div className="text-6xl mb-3">{currentPlayer.avatar}</div>
              <h2 className="text-2xl font-bold">{currentPlayer.name}</h2>
            </div>

            <StatBar
              label="Pontos de Vida"
              current={currentPlayer.pv.current}
              max={currentPlayer.pv.max}
              color="#ef4444"
              playerId={currentPlayer.id}
              stat="pv"
              icon={Droplet}
            />

            <StatBar
              label="Pontos de Determinação"
              current={currentPlayer.pd.current}
              max={currentPlayer.pd.max}
              color="#3b82f6"
              playerId={currentPlayer.id}
              stat="pd"
              icon={AlertCircle}
            />

            <StatBar
              label="Sanidade"
              current={currentPlayer.san.current}
              max={currentPlayer.san.max}
              color="#8b5cf6"
              playerId={currentPlayer.id}
              stat="san"
              icon={Brain}
            />

            <div className="mt-6">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Skull size={18} />
                Condições
              </h3>
              <div className="flex flex-wrap gap-2">
                {conditions.map(cond => (
                  <div
                    key={cond.id}
                    className={`px-3 py-2 rounded ${
                      currentPlayer.conditions.includes(cond.id)
                        ? 'bg-opacity-100'
                        : 'bg-opacity-20'
                    }`}
                    style={{ backgroundColor: cond.color }}
                  >
                    {cond.icon} {cond.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Painel do Mestre */}
      {isGM && showGMPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Users size={24} />
                Painel do Mestre
              </h2>
              <button onClick={() => setShowGMPanel(false)} className="text-gray-400 hover:text-white text-2xl">✕</button>
            </div>

            <div className="mb-6">
              <h3 className="font-bold mb-3">Tokens</h3>
              <div className="flex gap-2">
                <button onClick={() => addToken('player')} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 flex items-center gap-2">
                  <Plus size={18} />
                  Adicionar Jogador
                </button>
                <button onClick={() => addToken('monster')} className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 flex items-center gap-2">
                  <Plus size={18} />
                  Adicionar Monstro
                </button>
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-3">Jogadores</h3>
              <div className="space-y-4">
                {gameState.players.map(player => (
                  <div key={player.id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">{player.avatar}</span>
                      <h4 className="text-xl font-bold">{player.name}</h4>
                    </div>

                    <StatBar
                      label="PV"
                      current={player.pv.current}
                      max={player.pv.max}
                      color="#ef4444"
                      playerId={player.id}
                      stat="pv"
                      icon={Droplet}
                    />

                    <StatBar
                      label="PD"
                      current={player.pd.current}
                      max={player.pd.max}
                      color="#3b82f6"
                      playerId={player.id}
                      stat="pd"
                      icon={AlertCircle}
                    />

                    <StatBar
                      label="SAN"
                      current={player.san.current}
                      max={player.san.max}
                      color="#8b5cf6"
                      playerId={player.id}
                      stat="san"
                      icon={Brain}
                    />

                    <div className="mt-3">
                      <label className="text-sm text-gray-400 block mb-2">Condições</label>
                      <div className="flex flex-wrap gap-2">
                        {conditions.map(cond => (
                          <button
                            key={cond.id}
                            onClick={() => {
                              const hasCondition = player.conditions.includes(cond.id);
                              updatePlayer(player.id, {
                                conditions: hasCondition
                                  ? player.conditions.filter(c => c !== cond.id)
                                  : [...player.conditions, cond.id]
                              });
                            }}
                            className={`px-2 py-1 rounded text-xs ${
                              player.conditions.includes(cond.id)
                                ? 'bg-opacity-100'
                                : 'bg-opacity-30'
                            }`}
                            style={{ backgroundColor: cond.color }}
                          >
                            {cond.icon} {cond.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdemParanormalRPG;