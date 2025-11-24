import React, { useState, useEffect, useRef } from 'react';
import { Users, Upload, Download, Settings, Plus, Trash2, AlertCircle, Skull, Brain, Droplet, Share2, LogIn } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDoc } from 'firebase/firestore';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDo8RDcPhraQ3jKS3gz0a6as-yCLrL_5to",
  authDomain: "rpg-a-vigilancia.firebaseapp.com",
  projectId: "rpg-a-vigilancia",
  storageBucket: "rpg-a-vigilancia.firebasestorage.app",
  messagingSenderId: "960996820934",
  appId: "1:960996820934:web:b1a977a4878840e93794c7",
  measurementId: "G-W4WMWZ0T1W"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const OrdemParanormalRPG = () => {
  // Estados de Autenticação e Sessão
  const [user, setUser] = useState(null);
  const [isGM, setIsGM] = useState(null);
  const [nickname, setNickname] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [inputSessionId, setInputSessionId] = useState('');
  
  // Estado do Jogo
  const [gameState, setGameState] = useState({
    map: null,
    tokens: [],
    players: []
  });

  // Estados de UI
  const [selectedToken, setSelectedToken] = useState(null);
  const [showGMPanel, setShowGMPanel] = useState(false);
  const [draggedToken, setDraggedToken] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const mapRef = useRef(null);

  const conditions = [
    { id: 'bleeding', label: 'Sangrando', icon: '🩸', color: '#ef4444' },
    { id: 'stunned', label: 'Atordoado', icon: '💫', color: '#f59e0b' },
    { id: 'fear', label: 'Medo', icon: '😱', color: '#8b5cf6' },
    { id: 'madness', label: 'Loucura', icon: '🌀', color: '#ec4899' }
  ];

  // 1. Inicializar Autenticação
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
           await signInWithCustomToken(auth, __initial_auth_token);
        } else {
           await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Erro na autenticação:", error);
        setErrorMsg("Erro ao conectar com o servidor.");
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Sincronização em Tempo Real (Listener)
  useEffect(() => {
    if (!user || !sessionId) return;

    // Referência ao documento da sessão pública
    // Path: artifacts/{appId}/public/data/{sessionId}
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', sessionId);

    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        
        // Só atualiza se houver mudança real para evitar re-renders infinitos
        // (Uma comparação profunda simples)
        setGameState(prevState => {
          if (JSON.stringify(prevState) !== JSON.stringify(remoteData)) {
            return remoteData;
          }
          return prevState;
        });
      } else {
        // Se o documento não existe e sou GM, ele será criado na primeira escrita
        // Se sou player, pode ser que a sala não exista
        if (!isGM) {
          setErrorMsg("Sessão não encontrada ou ainda não iniciada pelo Mestre.");
        }
      }
    }, (error) => {
      console.error("Erro no snapshot:", error);
      setErrorMsg("Erro de conexão com a sessão.");
    });

    return () => unsubscribe();
  }, [user, sessionId, isGM]);

  // 3. Função para Salvar no Firestore
  const saveGame = async (newState) => {
    if (!user || !sessionId) return;

    // Atualização Otimista (Update Local Primeiro)
    setGameState(newState);

    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', sessionId);
      await setDoc(sessionRef, newState);
    } catch (error) {
      console.error("Erro ao salvar estado:", error);
      // Em um app real, reverteríamos o estado aqui
    }
  };

  // Handlers de Login
  const handleJoinSession = async (asGM) => {
    if (!nickname.trim()) {
      setErrorMsg("Por favor, insira um nickname.");
      return;
    }
    if (!inputSessionId.trim()) {
      setErrorMsg("Por favor, insira ou gere um ID de sessão.");
      return;
    }

    const targetSessionId = inputSessionId.trim(); // Normaliza o ID
    setIsGM(asGM);
    setSessionId(targetSessionId);

    // Se for jogador, tenta se adicionar à lista se ainda não existir
    if (!asGM) {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', targetSessionId);
      try {
        const docSnap = await getDoc(sessionRef);
        let currentData = docSnap.exists() ? docSnap.data() : { players: [], tokens: [], map: null };
        
        const existingPlayer = currentData.players?.find(p => p.name === nickname);
        
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
          
          // Atualiza no banco
          await setDoc(sessionRef, {
            ...currentData,
            players: [...(currentData.players || []), newPlayer]
          });
        }
      } catch (err) {
        console.error("Erro ao entrar na sala:", err);
      }
    }
  };

  // Gera ID aleatório
  const generateSessionId = () => {
    setInputSessionId(Math.random().toString(36).substr(2, 9).toUpperCase());
  };

  // --- LÓGICA DO JOGO (Adaptada para usar saveGame) ---

  const handleMapUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Aviso: Firestore tem limite de 1MB por documento. 
      // Mapas grandes em base64 podem falhar. Ideal seria usar Storage, mas aqui usaremos compressão básica ou limite.
      if (file.size > 800000) {
        alert("A imagem é muito grande para sincronização em tempo real (limite ~800kb). Tente uma imagem menor.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        saveGame({ ...gameState, map: event.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const addToken = (type) => {
    const newToken = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      name: type === 'player' ? 'Novo Jogador' : 'Monstro',
      x: 50,
      y: 50,
      size: 60,
      pv: { current: 20, max: 20 },
      conditions: []
    };
    saveGame({ ...gameState, tokens: [...gameState.tokens, newToken] });
  };

  const updateToken = (id, updates) => {
    saveGame({
      ...gameState,
      tokens: gameState.tokens.map(t => t.id === id ? { ...t, ...updates } : t)
    });
  };

  const deleteToken = (id) => {
    saveGame({
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
      // Limpa stack antigo
      if (undoStack.length > 10) setUndoStack(undoStack.slice(1));
    }
    
    saveGame(newState);
  };

  const undo = () => {
    if (undoStack.length > 0) {
      const last = undoStack[undoStack.length - 1];
      saveGame(last.state);
      setUndoStack(undoStack.slice(0, -1));
    }
  };

  const handleTokenDragStart = (token, e) => {
    if (!isGM) return; // Apenas GM move tokens no mapa por padrão, ou mude se quiser
    setDraggedToken(token);
  };

  const handleMapDrop = (e) => {
    e.preventDefault();
    if (!draggedToken || !mapRef.current || !isGM) return;

    const rect = mapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    updateToken(draggedToken.id, { x, y });
    setDraggedToken(null);
  };

  // Funções Auxiliares
  const copySessionId = () => {
    const el = document.createElement('textarea');
    el.value = sessionId;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert("ID da sessão copiado!");
  };

  const adjustStat = (playerId, stat, amount) => {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    const newValue = Math.max(0, Math.min(player[stat].max, player[stat].current + amount));
    updatePlayer(playerId, {
      [stat]: { ...player[stat], current: newValue }
    });
  };

  // --- COMPONENTES INTERNOS ---

  const StatBar = ({ label, current, max, color, playerId, stat, icon: Icon }) => {
    const percentage = max > 0 ? (current / max) * 100 : 0;
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
                  onClick={(e) => { e.stopPropagation(); adjustStat(playerId, stat, -5); }} 
                  className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                >-5</button>
                <button 
                  onClick={(e) => { e.stopPropagation(); adjustStat(playerId, stat, -1); }} 
                  className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                >-1</button>
              </>
            )}
            <div className="flex items-center gap-1 text-sm font-mono bg-gray-900 rounded px-2">
              <span className={current < max / 4 ? "text-red-500 animate-pulse" : "text-white"}>
                {current}
              </span>
              <span className="text-gray-500">/</span>
              <span className="text-gray-400">{max}</span>
            </div>
            {canEdit && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); adjustStat(playerId, stat, 1); }} 
                  className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                >+1</button>
                <button 
                  onClick={(e) => { e.stopPropagation(); adjustStat(playerId, stat, 5); }} 
                  className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                >+5</button>
              </>
            )}
          </div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-6 overflow-hidden relative border border-gray-600">
          <div
            className="h-full transition-all duration-500 ease-out flex items-center justify-center text-white text-xs font-bold shadow-lg"
            style={{
              width: `${percentage}%`,
              backgroundColor: color
            }}
          >
            {percentage > 15 && `${Math.round(percentage)}%`}
          </div>
        </div>
      </div>
    );
  };

  // --- RENDERIZAÇÃO ---

  if (isLoading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Carregando sistema...</div>;
  }

  // TELA DE LOGIN / SELEÇÃO DE SESSÃO
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-2xl border border-purple-500">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2 tracking-wider" style={{ fontFamily: 'Impact, sans-serif' }}>ORDEM</h1>
            <h2 className="text-xl text-purple-400 tracking-widest uppercase">Paranormal RPG</h2>
          </div>
          
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-500 bg-opacity-20 border border-red-500 rounded text-red-200 text-sm text-center">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Seu Nome</label>
              <input
                type="text"
                placeholder="Ex: Thiago, Joui..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-1 block">ID da Sessão (Sala)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Código da Sala"
                  value={inputSessionId}
                  onChange={(e) => setInputSessionId(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none transition font-mono uppercase"
                />
                <button 
                  onClick={generateSessionId}
                  className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 text-xs"
                  title="Gerar novo ID aleatório"
                >
                  Gerar Novo
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <button
                onClick={() => handleJoinSession(true)}
                className="px-4 py-3 bg-purple-600 text-white rounded font-bold hover:bg-purple-700 transition flex items-center justify-center gap-2"
              >
                <Users size={18} />
                Sou Mestre
              </button>
              <button
                onClick={() => handleJoinSession(false)}
                className="px-4 py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                <LogIn size={18} />
                Sou Jogador
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentPlayer = gameState.players.find(p => p.name === nickname);

  return (
    <div className="min-h-screen bg-gray-900 text-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-wider">ORDEM <span className="text-purple-500 text-sm">PARANORMAL</span></h1>
          <div className="h-6 w-px bg-gray-600"></div>
          <div className="flex items-center gap-2 text-sm bg-gray-900 px-3 py-1 rounded-full border border-gray-700">
            <span className="text-gray-400">Sessão:</span>
            <span className="font-mono text-green-400 font-bold tracking-widest">{sessionId}</span>
            <button onClick={copySessionId} className="text-gray-400 hover:text-white ml-2">
              <Share2 size={14} />
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {isGM && (
            <>
              <button onClick={() => setShowGMPanel(!showGMPanel)} className={`px-3 py-2 rounded flex items-center gap-2 transition ${showGMPanel ? 'bg-purple-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-purple-600 hover:text-white'}`}>
                <Settings size={18} />
                <span className="hidden md:inline">Painel Mestre</span>
              </button>
              <label className="px-3 py-2 bg-blue-600 rounded hover:bg-blue-700 cursor-pointer flex items-center gap-2 transition text-white shadow-lg hover:shadow-blue-500/50">
                <Upload size={18} />
                <span className="hidden md:inline">Mapa</span>
                <input type="file" accept="image/*" onChange={handleMapUpload} className="hidden" />
              </label>
            </>
          )}
          
          {isGM && undoStack.length > 0 && (
            <button onClick={undo} className="px-3 py-2 bg-gray-700 border border-gray-600 rounded hover:bg-red-900/50 text-gray-300 hover:text-red-200 transition flex items-center gap-2">
              Desfazer
            </button>
          )}
          
          <button onClick={() => { setSessionId(''); setNickname(''); }} className="px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded ml-2">
            Sair
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Área Central (Mapa) */}
        <div className="flex-1 relative bg-gray-900 overflow-hidden flex flex-col">
          <div
            ref={mapRef}
            className="flex-1 relative w-full h-full"
            onDrop={handleMapDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{
              backgroundImage: gameState.map ? `url(${gameState.map})` : 'none',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundColor: '#111827'
            }}
          >
            {!gameState.map && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-600 select-none pointer-events-none">
                <div className="text-center border-2 border-dashed border-gray-700 p-12 rounded-xl">
                  <Skull size={64} className="mx-auto mb-4 opacity-50" />
                  <p className="text-2xl font-bold mb-2">O Vazio</p>
                  {isGM ? <p className="text-sm">Carregue um mapa para começar o ritual.</p> : <p className="text-sm">Aguardando o Mestre manifestar a realidade...</p>}
                </div>
              </div>
            )}

            {/* Tokens */}
            {gameState.tokens.map(token => (
              <div
                key={token.id}
                draggable={isGM}
                onDragStart={(e) => handleTokenDragStart(token, e)}
                onClick={(e) => { e.stopPropagation(); setSelectedToken(token); }}
                className={`absolute cursor-pointer transition-transform hover:scale-110 group ${selectedToken?.id === token.id ? 'z-50 scale-110' : 'z-10'}`}
                style={{
                  left: `${token.x}%`,
                  top: `${token.y}%`,
                  width: `${token.size}px`,
                  height: `${token.size}px`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className={`w-full h-full rounded-full border-4 flex items-center justify-center text-2xl shadow-lg overflow-hidden relative ${
                  token.type === 'player' 
                    ? 'bg-blue-900 border-blue-500 shadow-blue-500/30' 
                    : 'bg-red-900 border-red-600 shadow-red-600/30'
                } ${selectedToken?.id === token.id ? 'ring-4 ring-white' : ''}`}>
                  {token.type === 'player' ? '🎭' : '👹'}
                  
                  {/* Barra de Vida Mini no Token */}
                  <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gray-900">
                     <div 
                        className="h-full bg-green-500" 
                        style={{ width: `${(token.pv.current / token.pv.max) * 100}%` }}
                     ></div>
                  </div>
                </div>

                {/* Nome flutuante */}
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900/90 border border-gray-700 px-2 py-1 rounded text-[10px] whitespace-nowrap text-white font-bold pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  {token.name}
                </div>

                {/* Condições */}
                {token.conditions.length > 0 && (
                  <div className="absolute -top-3 -right-3 flex flex-wrap max-w-[60px] justify-end">
                    {token.conditions.map(cond => {
                      const condition = conditions.find(c => c.id === cond);
                      return condition ? (
                        <span key={cond} className="text-lg drop-shadow-md bg-gray-900 rounded-full p-0.5" title={condition.label}>{condition.icon}</span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Card de Edição de Token (Flutuante) */}
            {selectedToken && (
              <div className="absolute top-4 right-4 bg-gray-800/95 border border-gray-600 rounded-lg p-4 w-72 shadow-2xl backdrop-blur-sm z-50" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4 pb-2 border-b border-gray-700">
                  <input
                    type="text"
                    value={selectedToken.name}
                    onChange={(e) => updateToken(selectedToken.id, { name: e.target.value })}
                    className="font-bold text-lg bg-transparent border-none outline-none text-white placeholder-gray-500 w-full"
                    disabled={!isGM}
                  />
                  <button onClick={() => setSelectedToken(null)} className="text-gray-400 hover:text-white p-1">✕</button>
                </div>
                
                <div className="mb-4 bg-gray-900/50 p-3 rounded">
                  <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Pontos de Vida</label>
                  <div className="flex items-center gap-2">
                    <button 
                       disabled={!isGM}
                       onClick={() => updateToken(selectedToken.id, { pv: { ...selectedToken.pv, current: Math.max(0, selectedToken.pv.current - 1) } })}
                       className="w-8 h-8 bg-red-900 rounded text-red-200 hover:bg-red-800 disabled:opacity-50"
                    >-</button>
                    <div className="flex-1 flex items-center gap-1 justify-center">
                        <input
                        type="number"
                        value={selectedToken.pv.current}
                        onChange={(e) => {
                            if(!isGM) return;
                            const val = parseInt(e.target.value) || 0;
                            updateToken(selectedToken.id, { pv: { ...selectedToken.pv, current: val } });
                        }}
                        className="w-12 px-1 py-1 bg-transparent text-center font-bold text-xl outline-none"
                        disabled={!isGM}
                        />
                        <span className="text-gray-500">/</span>
                        <input
                        type="number"
                        value={selectedToken.pv.max}
                        onChange={(e) => {
                            if(!isGM) return;
                            const val = parseInt(e.target.value) || 1;
                            updateToken(selectedToken.id, { pv: { ...selectedToken.pv, max: val } });
                        }}
                        className="w-12 px-1 py-1 bg-transparent text-center text-gray-400 outline-none"
                        disabled={!isGM}
                        />
                    </div>
                    <button 
                       disabled={!isGM}
                       onClick={() => updateToken(selectedToken.id, { pv: { ...selectedToken.pv, current: Math.min(selectedToken.pv.max, selectedToken.pv.current + 1) } })}
                       className="w-8 h-8 bg-green-900 rounded text-green-200 hover:bg-green-800 disabled:opacity-50"
                    >+</button>
                  </div>
                  <div className="w-full bg-gray-700 h-1 mt-2 rounded overflow-hidden">
                      <div className="bg-red-500 h-full transition-all" style={{ width: `${(selectedToken.pv.current / selectedToken.pv.max) * 100}%`}}></div>
                  </div>
                </div>

                {isGM && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Tamanho (Zoom)</label>
                      <input
                        type="range"
                        min="30"
                        max="200"
                        value={selectedToken.size}
                        onChange={(e) => updateToken(selectedToken.id, { size: parseInt(e.target.value) })}
                        className="w-full accent-purple-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Condições</label>
                      <div className="grid grid-cols-2 gap-2">
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
                            className={`px-2 py-1.5 rounded text-xs flex items-center gap-2 border transition ${
                              selectedToken.conditions.includes(cond.id)
                                ? 'bg-gray-700 border-gray-500 text-white'
                                : 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500'
                            }`}
                            style={{ borderColor: selectedToken.conditions.includes(cond.id) ? cond.color : undefined }}
                          >
                            <span>{cond.icon}</span>
                            {cond.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        deleteToken(selectedToken.id);
                        setSelectedToken(null);
                      }}
                      className="w-full py-2 bg-red-900/50 border border-red-800 text-red-200 rounded hover:bg-red-900 transition flex items-center justify-center gap-2 text-sm"
                    >
                      <Trash2 size={14} />
                      Remover do Tabuleiro
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: HUD do Jogador OU Painel Mestre */}
        <div className={`w-96 bg-gray-800 border-l border-gray-700 flex flex-col transition-all duration-300 ${isGM && !showGMPanel ? 'w-0 opacity-0 overflow-hidden border-none' : ''}`}>
            
            {/* Se for GM, mostra lista de todos. Se for Jogador, mostra o próprio. */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {isGM ? (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold flex items-center gap-2 text-purple-400">
                                <Users size={20} /> Gerenciador
                            </h2>
                            <div className="flex gap-2">
                                <button onClick={() => addToken('player')} className="p-2 bg-blue-600 rounded hover:bg-blue-700 text-white" title="Add Token Jogador"><Plus size={16} /></button>
                                <button onClick={() => addToken('monster')} className="p-2 bg-red-600 rounded hover:bg-red-700 text-white" title="Add Token Monstro"><Plus size={16} /></button>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {gameState.players.length === 0 && <p className="text-gray-500 text-center italic">Nenhum jogador conectado.</p>}
                            {gameState.players.map(player => (
                                <div key={player.id} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                                    <div className="flex items-center gap-3 mb-4 border-b border-gray-600 pb-2">
                                        <span className="text-2xl bg-gray-800 rounded p-1">{player.avatar}</span>
                                        <h4 className="text-lg font-bold">{player.name}</h4>
                                    </div>

                                    <StatBar label="PV" current={player.pv.current} max={player.pv.max} color="#ef4444" playerId={player.id} stat="pv" icon={Droplet} />
                                    <StatBar label="PD" current={player.pd.current} max={player.pd.max} color="#3b82f6" playerId={player.id} stat="pd" icon={AlertCircle} />
                                    <StatBar label="SAN" current={player.san.current} max={player.san.max} color="#8b5cf6" playerId={player.id} stat="san" icon={Brain} />
                                </div>
                            ))}
                        </div>
                    </>
                ) : currentPlayer ? (
                    <>
                        <div className="text-center mb-8 relative">
                            <div className="w-24 h-24 bg-gray-700 rounded-full mx-auto flex items-center justify-center text-5xl border-4 border-gray-600 mb-4 shadow-xl">
                                {currentPlayer.avatar}
                            </div>
                            <h2 className="text-3xl font-bold text-white tracking-wide">{currentPlayer.name}</h2>
                            <span className="text-xs text-gray-500 uppercase tracking-widest">Investigador</span>
                        </div>

                        <div className="space-y-6">
                             <StatBar label="Pontos de Vida" current={currentPlayer.pv.current} max={currentPlayer.pv.max} color="#ef4444" playerId={currentPlayer.id} stat="pv" icon={Droplet} />
                             <StatBar label="Determinação" current={currentPlayer.pd.current} max={currentPlayer.pd.max} color="#3b82f6" playerId={currentPlayer.id} stat="pd" icon={AlertCircle} />
                             <StatBar label="Sanidade" current={currentPlayer.san.current} max={currentPlayer.san.max} color="#8b5cf6" playerId={currentPlayer.id} stat="san" icon={Brain} />
                             
                             <div className="pt-6 border-t border-gray-700">
                                <h3 className="font-bold mb-3 flex items-center gap-2 text-gray-400 text-sm uppercase">
                                    <Skull size={16} /> Condições Atuais
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {currentPlayer.conditions.length === 0 && <span className="text-gray-600 text-sm italic">Nenhuma condição afetando você.</span>}
                                    {conditions.map(cond => (
                                        <button
                                            key={cond.id}
                                            onClick={() => {
                                                const hasCondition = currentPlayer.conditions.includes(cond.id);
                                                updatePlayer(currentPlayer.id, {
                                                    conditions: hasCondition
                                                        ? currentPlayer.conditions.filter(c => c !== cond.id)
                                                        : [...currentPlayer.conditions, cond.id]
                                                });
                                            }}
                                            className={`px-3 py-2 rounded flex items-center gap-2 text-sm transition border ${
                                                currentPlayer.conditions.includes(cond.id)
                                                    ? 'bg-gray-700 border-gray-500 text-white shadow-md'
                                                    : 'bg-transparent border-gray-700 text-gray-600 grayscale hover:grayscale-0 hover:text-white hover:border-gray-500'
                                            }`}
                                            style={{ borderColor: currentPlayer.conditions.includes(cond.id) ? cond.color : undefined }}
                                        >
                                            <span>{cond.icon}</span>
                                            {cond.label}
                                        </button>
                                    ))}
                                </div>
                             </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center text-gray-500 mt-10">Personagem não encontrado nesta sessão.</div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default OrdemParanormalRPG;