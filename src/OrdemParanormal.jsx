import React, { useState, useEffect, useRef } from 'react';
import { Users, Upload, Settings, Plus, Trash2, AlertCircle, Skull, Brain, Droplet, Share2, LogIn, Image as ImageIcon, Edit3, Camera, Ghost } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';

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

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Erro fatal ao iniciar Firebase:", error);
}

const appId = "rpg-a-vigilancia";

// Função utilitária para comprimir imagens
const compressImage = (file, maxWidth = 1280, quality = 0.6) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width *= maxWidth / height;
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// Componente de Input Numérico Inteligente (Resolve o problema de digitação)
const StatInput = ({ value, onCommit, disabled, className, min = 0 }) => {
  const [localValue, setLocalValue] = useState(value);

  // Sincroniza se o valor mudar externamente (ex: outro player editou)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e) => {
    setLocalValue(e.target.value);
  };

  const handleBlur = () => {
    let val = parseInt(localValue);
    if (isNaN(val)) val = min;
    
    // Só salva se o valor realmente mudou
    if (val !== value) {
      onCommit(val);
    } else {
      setLocalValue(value); // Reverte visualmente se inválido ou igual
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur(); // Força o blur para salvar
    }
  };

  return (
    <input
      type="number"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={className}
    />
  );
};

const OrdemParanormalRPG = () => {
  const [user, setUser] = useState(null);
  const [isGM, setIsGM] = useState(null);
  const [nickname, setNickname] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [inputSessionId, setInputSessionId] = useState('');
  
  const [activeTab, setActiveTab] = useState('players');

  const [gameState, setGameState] = useState({
    map: null,
    tokens: [],
    players: [],
    monsters: []
  });

  const [selectedToken, setSelectedToken] = useState(null);
  const [showGMPanel, setShowGMPanel] = useState(false);
  const [draggedToken, setDraggedToken] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  const mapRef = useRef(null);
  const avatarInputRef = useRef(null);
  const tokenImageInputRef = useRef(null);
  const monsterImageInputRef = useRef({});

  const conditions = [
    { id: 'bleeding', label: 'Sangrando', icon: '🩸', color: '#ef4444' },
    { id: 'stunned', label: 'Atordoado', icon: '💫', color: '#f59e0b' },
    { id: 'fear', label: 'Medo', icon: '😱', color: '#8b5cf6' },
    { id: 'madness', label: 'Loucura', icon: '🌀', color: '#ec4899' }
  ];

  const defaultAvatars = ['🕵️', '🔫', '🔦', '📓', '🚬', '🩹', '🔮', '🎭'];
  const monsterAvatars = ['👹', '👻', '💀', '🧛', '🧟', '🕷️', '🦑', '🐺'];

  useEffect(() => {
    if (!auth) {
      setErrorMsg("Erro Crítico: Firebase não inicializou.");
      setIsLoading(false);
      return;
    }
    const initAuth = async () => {
      try {
        await signOut(auth).catch(() => {}); 
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Erro na autenticação:", error);
        setErrorMsg(`Erro de Login: ${error.message}`);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !sessionId || !db) return;
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionId);
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        const safeData = {
            map: remoteData.map || null,
            tokens: Array.isArray(remoteData.tokens) ? remoteData.tokens : [],
            players: Array.isArray(remoteData.players) ? remoteData.players : [],
            monsters: Array.isArray(remoteData.monsters) ? remoteData.monsters : []
        };
        setGameState(prevState => {
          if (JSON.stringify(prevState) !== JSON.stringify(safeData)) {
            return safeData;
          }
          return prevState;
        });
      } else {
        if (!isGM) setErrorMsg("Sessão não encontrada. O Mestre deve criar a sala primeiro.");
      }
    }, (error) => {
      console.error("Snapshot error:", error);
      setErrorMsg("Erro de conexão.");
    });
    return () => unsubscribe();
  }, [user, sessionId, isGM]);

  const saveGame = async (newState) => {
    if (!user || !sessionId || !db) return;
    setGameState(newState);
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionId);
      await setDoc(sessionRef, newState);
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  const handleJoinSession = async (asGM) => {
    if (!nickname.trim()) { setErrorMsg("Insira um nickname."); return; }
    if (!inputSessionId.trim()) { setErrorMsg("Insira um ID de sessão."); return; }

    const targetSessionId = inputSessionId.trim();
    setIsGM(asGM);
    setSessionId(targetSessionId);

    if (!db) return;

    if (!asGM) {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', targetSessionId);
      try {
        const docSnap = await getDoc(sessionRef);
        if (!docSnap.exists()) {
            setErrorMsg("Sala inexistente.");
            setSessionId(''); 
            return;
        }

        let currentData = docSnap.data();
        const currentPlayers = Array.isArray(currentData.players) ? currentData.players : [];
        const existingPlayer = currentPlayers.find(p => p.name === nickname);
        
        if (!existingPlayer) {
          const randomAvatar = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];
          const newPlayerId = Math.random().toString(36).substr(2, 9);
          
          const newPlayer = {
            id: newPlayerId,
            type: 'player',
            name: nickname,
            role: 'Investigador',
            avatar: randomAvatar,
            image: null,
            pv: { current: 20, max: 20 },
            pd: { current: 5, max: 5 },
            san: { current: 100, max: 100 },
            conditions: []
          };

          const newToken = {
            id: `token-${newPlayerId}`,
            type: 'player',
            name: nickname,
            x: 50, y: 50, size: 60,
            linkedId: newPlayerId,
            avatar: randomAvatar,
            image: null, 
            pv: { current: 20, max: 20 },
            conditions: []
          };

          const currentTokens = Array.isArray(currentData.tokens) ? currentData.tokens : [];

          await setDoc(sessionRef, {
            ...currentData,
            players: [...currentPlayers, newPlayer],
            tokens: [...currentTokens, newToken]
          });
        }
      } catch (err) {
        console.error("Join error:", err);
      }
    } else {
        const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', targetSessionId);
        const docSnap = await getDoc(sessionRef);
        if (!docSnap.exists()) {
             await setDoc(sessionRef, { map: null, tokens: [], players: [], monsters: [] });
        }
    }
  };

  const generateSessionId = () => setInputSessionId(Math.random().toString(36).substr(2, 9).toUpperCase());

  const handleMapUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setIsUploading(true);
      try {
        const compressedBase64 = await compressImage(file, 1280, 0.6);
        if (compressedBase64.length > 900000) {
            alert("Imagem muito grande.");
            setIsUploading(false);
            return;
        }
        await saveGame({ ...gameState, map: compressedBase64 });
      } catch (err) {
        console.error("Upload error:", err);
        alert("Erro ao processar imagem.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleImageUpload = async (e, targetId, isEntity = false, entityType = 'player') => {
    const file = e.target.files[0];
    if (file) {
        try {
            const compressedBase64 = await compressImage(file, 300, 0.7);
            
            if (isEntity) {
                if (entityType === 'player') {
                    updatePlayer(targetId, { image: compressedBase64, avatar: '' });
                } else if (entityType === 'monster') {
                    updateMonster(targetId, { image: compressedBase64, avatar: '' });
                }
            } else {
                updateToken(targetId, { image: compressedBase64, avatar: '' });
            }
        } catch (err) {
            console.error("Avatar upload error:", err);
            alert("Erro ao enviar imagem.");
        }
    }
  };

  const addMonster = () => {
    const monsterId = Math.random().toString(36).substr(2, 9);
    const randomAvatar = monsterAvatars[Math.floor(Math.random() * monsterAvatars.length)];

    const newMonster = {
        id: monsterId,
        type: 'monster',
        name: 'Nova Ameaça',
        role: 'Criatura',
        avatar: randomAvatar,
        image: null,
        pv: { current: 50, max: 50 },
        pd: { current: 0, max: 0 },
        san: { current: 0, max: 0 },
        conditions: []
    };

    const newToken = {
        id: `token-${monsterId}`,
        type: 'monster',
        name: 'Nova Ameaça',
        x: 50, y: 50, size: 80,
        linkedId: monsterId,
        avatar: randomAvatar,
        image: null,
        pv: { current: 50, max: 50 },
        conditions: []
    };

    saveGame({
        ...gameState,
        monsters: [...(gameState.monsters || []), newMonster],
        tokens: [...(gameState.tokens || []), newToken]
    });
  };

  const updateMonster = (id, updates) => {
    let newTokens = gameState.tokens || [];
    
    if (updates.image !== undefined || updates.avatar !== undefined || updates.name !== undefined || updates.pv !== undefined) {
        newTokens = newTokens.map(t => {
            if (t.linkedId === id) {
                return { 
                    ...t, 
                    ...(updates.image !== undefined ? { image: updates.image } : {}),
                    ...(updates.avatar !== undefined ? { avatar: updates.avatar } : {}),
                    ...(updates.name !== undefined ? { name: updates.name } : {}),
                    ...(updates.pv !== undefined ? { pv: updates.pv } : {})
                };
            }
            return t;
        });
    }

    const newState = {
        ...gameState,
        tokens: newTokens,
        monsters: (gameState.monsters || []).map(m => m.id === id ? { ...m, ...updates } : m)
    };
    saveGame(newState);
  };

  const deleteMonster = (id) => {
      const newState = {
          ...gameState,
          monsters: (gameState.monsters || []).filter(m => m.id !== id),
          tokens: (gameState.tokens || []).filter(t => t.linkedId !== id)
      };
      saveGame(newState);
  };

  const addToken = (type) => {
    const newToken = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      name: type === 'player' ? 'Novo Jogador' : 'Monstro',
      x: 50, y: 50, size: 60,
      avatar: type === 'player' ? '🎭' : '👹',
      image: null,
      pv: { current: 20, max: 20 },
      conditions: []
    };
    saveGame({ ...gameState, tokens: [...(gameState.tokens || []), newToken] });
  };

  const updateToken = (id, updates) => saveGame({ ...gameState, tokens: (gameState.tokens || []).map(t => t.id === id ? { ...t, ...updates } : t) });
  const deleteToken = (id) => saveGame({ ...gameState, tokens: (gameState.tokens || []).filter(t => t.id !== id) });

  const updatePlayer = (id, updates) => {
    let newTokens = gameState.tokens || [];
    
    if (updates.image !== undefined || updates.avatar !== undefined || updates.name !== undefined || updates.pv !== undefined) {
        newTokens = newTokens.map(t => {
            if (t.linkedId === id) {
                return { 
                    ...t, 
                    ...(updates.image !== undefined ? { image: updates.image } : {}),
                    ...(updates.avatar !== undefined ? { avatar: updates.avatar } : {}),
                    ...(updates.name !== undefined ? { name: updates.name } : {}),
                    ...(updates.pv !== undefined ? { pv: updates.pv } : {})
                };
            }
            return t;
        });
    }
    
    const newState = { 
        ...gameState, 
        tokens: newTokens,
        players: (gameState.players || []).map(p => p.id === id ? { ...p, ...updates } : p) 
    };
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
      const currentPlayer = (gameState.players || []).find(p => p.name === nickname);
      const isOwner = isGM || (currentPlayer && token.linkedId === currentPlayer.id);
      if (isOwner) setDraggedToken(token); 
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

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId).then(() => alert("ID copiado!"));
  };

  const adjustStat = (entityId, stat, amount, isMonster = false) => {
    const list = isMonster ? gameState.monsters : gameState.players;
    const entity = list.find(e => e.id === entityId);
    if (!entity) return;
    
    const newValue = Math.max(0, Math.min(entity[stat].max, entity[stat].current + amount));
    
    if (isMonster) {
        updateMonster(entityId, { [stat]: { ...entity[stat], current: newValue } });
    } else {
        updatePlayer(entityId, { [stat]: { ...entity[stat], current: newValue } });
    }
  };

  const StatBar = ({ label, current, max, color, entityId, stat, icon: Icon, isMonster = false }) => {
    const percentage = max > 0 ? (current / max) * 100 : 0;
    const currentPlayer = (gameState.players || []).find(p => p.name === nickname);
    
    const isOwner = currentPlayer?.id === entityId;
    const canEdit = isGM || (isOwner && !isMonster);
    const canSeeValues = isGM || !isMonster;

    const handleCommit = (val, field) => {
        if (!canEdit) return;
        const list = isMonster ? gameState.monsters : gameState.players;
        const entity = list.find(e => e.id === entityId);
        
        if (isMonster) {
             updateMonster(entityId, { [stat]: { ...entity[stat], [field]: val } });
        } else {
             updatePlayer(entityId, { [stat]: { ...entity[stat], [field]: val } });
        }
    };

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
                <button onClick={(e) => { e.stopPropagation(); adjustStat(entityId, stat, -5, isMonster); }} className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">-5</button>
                <button onClick={(e) => { e.stopPropagation(); adjustStat(entityId, stat, -1, isMonster); }} className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">-1</button>
              </>
            )}
            
            <div className={`flex items-center gap-1 text-sm font-mono bg-gray-900 rounded px-2 border border-gray-700 ${!canSeeValues ? 'opacity-70' : ''}`}>
              {canSeeValues ? (
                  <>
                    <StatInput 
                      value={current} 
                      onCommit={(val) => handleCommit(val, 'current')} 
                      disabled={!canEdit} 
                      className={`w-12 bg-transparent text-center outline-none ${current < max / 4 ? "text-red-500 animate-pulse font-bold" : "text-white"}`} 
                    />
                    <span className="text-gray-500">/</span>
                    <StatInput 
                      value={max} 
                      onCommit={(val) => handleCommit(val, 'max')} 
                      disabled={!canEdit} 
                      className="w-12 bg-transparent text-center outline-none text-gray-400" 
                    />
                  </>
              ) : (
                  <span className="text-gray-400 tracking-widest px-2">?? / ??</span>
              )}
            </div>

            {canEdit && (
              <>
                <button onClick={(e) => { e.stopPropagation(); adjustStat(entityId, stat, 1, isMonster); }} className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600">+1</button>
                <button onClick={(e) => { e.stopPropagation(); adjustStat(entityId, stat, 5, isMonster); }} className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">+5</button>
              </>
            )}
          </div>
        </div>
        
        <div className="w-full bg-gray-700 rounded-full h-6 overflow-hidden relative border border-gray-600">
           {canSeeValues ? (
                <div className="h-full transition-all duration-500 ease-out flex items-center justify-center text-white text-xs font-bold shadow-lg" style={{ width: `${percentage}%`, backgroundColor: color }}>
                    {percentage > 15 && `${Math.round(percentage)}%`}
                </div>
           ) : (
                <div className="h-full w-full bg-gray-800 flex items-center justify-center text-xs text-gray-500 font-bold italic">
                    Oculto
                </div>
           )}
        </div>
      </div>
    );
  };

  if (isLoading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Carregando sistema...</div>;

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-2xl border border-purple-500">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2 tracking-wider" style={{ fontFamily: 'Impact, sans-serif' }}>ORDEM</h1>
            <h2 className="text-xl text-purple-400 tracking-widest uppercase">Paranormal RPG</h2>
          </div>
          {errorMsg && <div className="mb-4 p-3 bg-red-500 bg-opacity-20 border border-red-500 rounded text-red-200 text-sm text-center">{errorMsg}</div>}
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Seu Nome</label>
              <input type="text" placeholder="Ex: Thiago, Joui..." value={nickname} onChange={(e) => setNickname(e.target.value)} className="w-full px-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none transition" />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">ID da Sessão (Sala)</label>
              <div className="flex gap-2">
                <input type="text" placeholder="Código da Sala" value={inputSessionId} onChange={(e) => setInputSessionId(e.target.value.toUpperCase())} className="flex-1 px-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none transition font-mono uppercase" />
                <button onClick={generateSessionId} className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 text-xs" title="Gerar novo ID aleatório">Gerar Novo</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-4">
              <button onClick={() => handleJoinSession(true)} className="px-4 py-3 bg-purple-600 text-white rounded font-bold hover:bg-purple-700 transition flex items-center justify-center gap-2"><Users size={18} /> Sou Mestre</button>
              <button onClick={() => handleJoinSession(false)} className="px-4 py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"><LogIn size={18} /> Sou Jogador</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const safePlayers = Array.isArray(gameState.players) ? gameState.players : [];
  const safeMonsters = Array.isArray(gameState.monsters) ? gameState.monsters : [];
  const currentPlayer = safePlayers.find(p => p.name === nickname);
  const canEditSelectedToken = selectedToken && (isGM || (currentPlayer && selectedToken.linkedId === currentPlayer.id));

  const renderEntityCard = (entity, isMonster) => (
      <div key={entity.id} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 mb-4 relative group">
          {isGM && isMonster && (
              <button onClick={() => deleteMonster(entity.id)} className="absolute top-2 right-2 text-gray-500 hover:text-red-400 transition" title="Remover Monstro">
                  <Trash2 size={16} />
              </button>
          )}
          <div className="flex items-center gap-3 mb-4 border-b border-gray-600 pb-2">
                <div className="w-12 h-12 rounded overflow-hidden bg-gray-800 flex items-center justify-center text-2xl relative cursor-pointer" 
                    onClick={() => { if(isGM) monsterImageInputRef.current[entity.id]?.click(); }}
                >
                    {entity.image ? <img src={entity.image} alt={entity.name} className="w-full h-full object-cover" /> : entity.avatar}
                    {isGM && <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition"><Edit3 size={14} /></div>}
                </div>
                {isGM && isMonster && (
                    <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        ref={el => monsterImageInputRef.current[entity.id] = el}
                        onChange={(e) => handleImageUpload(e, entity.id, true, 'monster')}
                    />
                )}

                <div className="flex-1">
                    {isGM ? (
                        <input type="text" value={entity.name} onChange={(e) => isMonster ? updateMonster(entity.id, {name: e.target.value}) : updatePlayer(entity.id, {name: e.target.value})} className="font-bold bg-transparent outline-none w-full hover:bg-gray-800/50 rounded px-1" />
                    ) : (
                        <h4 className="font-bold">{entity.name}</h4>
                    )}
                    {isGM ? (
                         <input type="text" value={entity.role} onChange={(e) => isMonster ? updateMonster(entity.id, {role: e.target.value}) : updatePlayer(entity.id, {role: e.target.value})} className="text-xs text-gray-400 bg-transparent outline-none w-full" />
                    ) : (
                        <span className="text-xs text-gray-400 block">{entity.role}</span>
                    )}
                </div>
          </div>
          <StatBar label="PV" current={entity.pv.current} max={entity.pv.max} color="#ef4444" entityId={entity.id} stat="pv" icon={Droplet} isMonster={isMonster} />
          <StatBar label="PD" current={entity.pd.current} max={entity.pd.max} color="#3b82f6" entityId={entity.id} stat="pd" icon={AlertCircle} isMonster={isMonster} />
          <StatBar label="SAN" current={entity.san.current} max={entity.san.max} color="#8b5cf6" entityId={entity.id} stat="san" icon={Brain} isMonster={isMonster} />
      </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white overflow-hidden flex flex-col">
      <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-wider">ORDEM <span className="text-purple-500 text-sm">PARANORMAL</span></h1>
          <div className="h-6 w-px bg-gray-600"></div>
          <div className="flex items-center gap-2 text-sm bg-gray-900 px-3 py-1 rounded-full border border-gray-700">
            <span className="text-gray-400">Sessão:</span>
            <span className="font-mono text-green-400 font-bold tracking-widest">{sessionId}</span>
            <button onClick={copySessionId} className="text-gray-400 hover:text-white ml-2"><Share2 size={14} /></button>
          </div>
        </div>
        <div className="flex gap-2">
          {isGM && (
            <>
              <button onClick={() => setShowGMPanel(!showGMPanel)} className={`px-3 py-2 rounded flex items-center gap-2 transition ${showGMPanel ? 'bg-purple-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-purple-600 hover:text-white'}`}><Settings size={18} /><span className="hidden md:inline">Painel Mestre</span></button>
              <label className={`px-3 py-2 rounded cursor-pointer flex items-center gap-2 transition text-white shadow-lg ${isUploading ? 'bg-gray-600 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/50'}`}>
                {isUploading ? <span className="animate-spin">⏳</span> : <Upload size={18} />}
                <span className="hidden md:inline">{isUploading ? 'Enviando...' : 'Mapa'}</span>
                <input type="file" accept="image/*" onChange={handleMapUpload} className="hidden" disabled={isUploading} />
              </label>
            </>
          )}
          {isGM && undoStack.length > 0 && <button onClick={undo} className="px-3 py-2 bg-gray-700 border border-gray-600 rounded hover:bg-red-900/50 text-gray-300 hover:text-red-200 transition flex items-center gap-2">Desfazer</button>}
          <button onClick={() => { setSessionId(''); setNickname(''); }} className="px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded ml-2">Sair</button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative bg-gray-900 overflow-hidden flex flex-col">
          <div ref={mapRef} className="flex-1 relative w-full h-full" onDrop={handleMapDrop} onDragOver={(e) => e.preventDefault()} style={{ backgroundImage: gameState.map ? `url(${gameState.map})` : 'none', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundColor: '#111827' }}>
            {!gameState.map && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-600 select-none pointer-events-none">
                <div className="text-center border-2 border-dashed border-gray-700 p-12 rounded-xl">
                  {isUploading ? (
                     <div className="animate-pulse">
                        <ImageIcon size={64} className="mx-auto mb-4 text-blue-500" />
                        <p className="text-2xl font-bold mb-2 text-blue-400">Processando Realidade...</p>
                        <p className="text-sm">Comprimindo e enviando mapa.</p>
                     </div>
                  ) : (
                    <>
                        <Skull size={64} className="mx-auto mb-4 opacity-50" />
                        <p className="text-2xl font-bold mb-2">O Vazio</p>
                        {isGM ? <p className="text-sm">Carregue um mapa para começar o ritual.</p> : <p className="text-sm">Aguardando o Mestre manifestar a realidade...</p>}
                    </>
                  )}
                </div>
              </div>
            )}
            
            {(gameState.tokens || []).map(token => (
              <div key={token.id} draggable={isGM || (currentPlayer && token.linkedId === currentPlayer.id)} onDragStart={(e) => handleTokenDragStart(token, e)} onClick={(e) => { e.stopPropagation(); setSelectedToken(token); }} className={`absolute cursor-pointer transition-transform hover:scale-110 group ${selectedToken?.id === token.id ? 'z-50 scale-110' : 'z-10'}`} style={{ left: `${token.x}%`, top: `${token.y}%`, width: `${token.size}px`, height: `${token.size}px`, transform: 'translate(-50%, -50%)' }}>
                <div className={`w-full h-full rounded-full border-4 flex items-center justify-center text-2xl shadow-lg overflow-hidden relative ${token.type === 'player' ? 'bg-blue-900 border-blue-500 shadow-blue-500/30' : 'bg-red-900 border-red-600 shadow-red-600/30'} ${selectedToken?.id === token.id ? 'ring-4 ring-white' : ''}`}>
                  {token.image ? (
                      <img src={token.image} alt={token.name} className="w-full h-full object-cover" />
                  ) : (
                      token.avatar || (token.type === 'player' ? '🎭' : '👹')
                  )}
                  {(!token.linkedId || !safeMonsters.find(m => m.id === token.linkedId) || isGM) && (
                      <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gray-900"><div className="h-full bg-green-500" style={{ width: `${(token.pv.current / token.pv.max) * 100}%` }}></div></div>
                  )}
                </div>
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900/90 border border-gray-700 px-2 py-1 rounded text-[10px] whitespace-nowrap text-white font-bold pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">{token.name}</div>
                {(token.conditions || []).length > 0 && <div className="absolute -top-3 -right-3 flex flex-wrap max-w-[60px] justify-end">{(token.conditions || []).map(cond => { const condition = conditions.find(c => c.id === cond); return condition ? (<span key={cond} className="text-lg drop-shadow-md bg-gray-900 rounded-full p-0.5" title={condition.label}>{condition.icon}</span>) : null; })}</div>}
              </div>
            ))}
            
            {selectedToken && (
              <div className="absolute top-4 right-4 bg-gray-800/95 border border-gray-600 rounded-lg p-4 w-72 shadow-2xl backdrop-blur-sm z-50" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4 pb-2 border-b border-gray-700">
                  <input type="text" value={selectedToken.name} onChange={(e) => updateToken(selectedToken.id, { name: e.target.value })} className="font-bold text-lg bg-transparent border-none outline-none text-white placeholder-gray-500 w-full" disabled={!canEditSelectedToken} />
                  <button onClick={() => setSelectedToken(null)} className="text-gray-400 hover:text-white p-1">✕</button>
                </div>
                
                {canEditSelectedToken && (
                    <div className="mb-4">
                        <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Aparência</label>
                        <div className="flex gap-2">
                             <input 
                                type="text" 
                                value={selectedToken.avatar || ''} 
                                placeholder="Emoji"
                                onChange={(e) => updateToken(selectedToken.id, { avatar: e.target.value, image: null })}
                                className="w-16 bg-gray-900/50 text-white px-2 py-1 rounded border border-gray-700 focus:border-purple-500 outline-none text-center"
                            />
                            <label className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs flex items-center justify-center gap-2 cursor-pointer transition">
                                <Camera size={14} /> Upload Imagem
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    ref={tokenImageInputRef}
                                    onChange={(e) => handleImageUpload(e, selectedToken.id, false)}
                                />
                            </label>
                        </div>
                    </div>
                )}

                <div className="mb-4 bg-gray-900/50 p-3 rounded">
                  <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Pontos de Vida</label>
                  {canEditSelectedToken ? (
                      <>
                        <div className="flex items-center gap-2">
                            <button onClick={() => updateToken(selectedToken.id, { pv: { ...selectedToken.pv, current: Math.max(0, selectedToken.pv.current - 1) } })} className="w-8 h-8 bg-red-900 rounded text-red-200 hover:bg-red-800">-</button>
                            <div className="flex-1 flex items-center gap-1 justify-center">
                                {/* Substituição por StatInput para edição fluida no Token */}
                                <StatInput 
                                    value={selectedToken.pv.current} 
                                    onCommit={(val) => updateToken(selectedToken.id, { pv: { ...selectedToken.pv, current: val } })}
                                    className="w-12 px-1 py-1 bg-transparent text-center font-bold text-xl outline-none" 
                                />
                                <span className="text-gray-500">/</span>
                                <StatInput 
                                    value={selectedToken.pv.max} 
                                    onCommit={(val) => updateToken(selectedToken.id, { pv: { ...selectedToken.pv, max: val } })}
                                    className="w-12 px-1 py-1 bg-transparent text-center text-gray-400 outline-none" 
                                />
                            </div>
                            <button onClick={() => updateToken(selectedToken.id, { pv: { ...selectedToken.pv, current: Math.min(selectedToken.pv.max, selectedToken.pv.current + 1) } })} className="w-8 h-8 bg-green-900 rounded text-green-200 hover:bg-green-800">+</button>
                        </div>
                        <div className="w-full bg-gray-700 h-1 mt-2 rounded overflow-hidden"><div className="bg-red-500 h-full transition-all" style={{ width: `${(selectedToken.pv.current / selectedToken.pv.max) * 100}%`}}></div></div>
                      </>
                  ) : (
                      <div className="text-center text-gray-500 py-2 italic font-mono">Informação Oculta</div>
                  )}
                </div>

                <div className="space-y-4">
                  {(canEditSelectedToken) && (
                      <>
                        <div>
                        <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Tamanho (Zoom)</label>
                        <input type="range" min="30" max="200" value={selectedToken.size} onChange={(e) => updateToken(selectedToken.id, { size: parseInt(e.target.value) })} className="w-full accent-purple-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                        <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Condições</label>
                        <div className="grid grid-cols-2 gap-2">
                            {conditions.map(cond => (
                            <button key={cond.id} onClick={() => { const hasCondition = (selectedToken.conditions || []).includes(cond.id); updateToken(selectedToken.id, { conditions: hasCondition ? selectedToken.conditions.filter(c => c !== cond.id) : [...(selectedToken.conditions || []), cond.id] }); }} className={`px-2 py-1.5 rounded text-xs flex items-center gap-2 border transition ${(selectedToken.conditions || []).includes(cond.id) ? 'bg-gray-700 border-gray-500 text-white' : 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500'}`} style={{ borderColor: (selectedToken.conditions || []).includes(cond.id) ? cond.color : undefined }}>
                                <span>{cond.icon}</span>{cond.label}
                            </button>
                            ))}
                        </div>
                        </div>
                      </>
                  )}
                  {isGM && (
                     <button onClick={() => { deleteToken(selectedToken.id); setSelectedToken(null); }} className="w-full py-2 bg-red-900/50 border border-red-800 text-red-200 rounded hover:bg-red-900 transition flex items-center justify-center gap-2 text-sm"><Trash2 size={14} /> Remover do Tabuleiro</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className={`w-96 bg-gray-800 border-l border-gray-700 flex flex-col transition-all duration-300 ${isGM && !showGMPanel ? 'w-0 opacity-0 overflow-hidden border-none' : ''}`}>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {isGM ? (
                    <>
                        {/* ABAS DE NAVEGAÇÃO */}
                        <div className="flex gap-2 mb-4 border-b border-gray-700 pb-2">
                          <button 
                            onClick={() => setActiveTab('players')}
                            className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider transition ${activeTab === 'players' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-300'}`}
                          >
                            Investigadores
                          </button>
                          <button 
                            onClick={() => setActiveTab('monsters')}
                            className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider transition ${activeTab === 'monsters' ? 'text-red-400 border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-300'}`}
                          >
                            Ameaças
                          </button>
                        </div>

                        {/* CONTEÚDO DAS ABAS */}
                        {activeTab === 'players' && (
                          <div className="space-y-4">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-gray-500 uppercase font-bold">Gerenciar Jogadores</span>
                                <button onClick={() => addToken('player')} className="p-1.5 bg-blue-600 rounded hover:bg-blue-700 text-white" title="Add Token Genérico"><Plus size={14} /></button>
                              </div>
                              {safePlayers.length === 0 && <p className="text-gray-500 text-center italic text-sm">Nenhum investigador conectado.</p>}
                              {safePlayers.map(player => renderEntityCard(player, false))}
                          </div>
                        )}

                        {activeTab === 'monsters' && (
                          <div className="space-y-4">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-gray-500 uppercase font-bold">Gerenciar Ameaças</span>
                                <button onClick={addMonster} className="p-1.5 bg-red-600 rounded hover:bg-red-700 text-white flex items-center gap-1 text-xs font-bold"><Plus size={14} /> Criar</button>
                              </div>
                              {safeMonsters.length === 0 && <p className="text-gray-500 text-center italic text-sm">Nenhuma ameaça criada.</p>}
                              {safeMonsters.map(monster => renderEntityCard(monster, true))}
                          </div>
                        )}
                    </>
                ) : currentPlayer ? (
                    <>
                        <div className="text-center mb-8 relative group">
                            <div 
                                className="w-32 h-32 bg-gray-700 rounded-full mx-auto flex items-center justify-center text-6xl border-4 border-gray-600 mb-4 shadow-xl cursor-pointer hover:border-purple-500 hover:bg-gray-600 transition relative overflow-hidden"
                                onClick={() => avatarInputRef.current.click()}
                            >
                                {currentPlayer.image ? (
                                    <img src={currentPlayer.image} alt="Avatar" className="w-full h-full object-cover" />
                                ) : currentPlayer.avatar}
                                
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition">
                                    <div className="text-white text-xs font-bold flex flex-col items-center">
                                        <Camera size={20} className="mb-1" />
                                        Alterar
                                    </div>
                                </div>
                                <input 
                                    type="file" 
                                    ref={avatarInputRef} 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(e, currentPlayer.id, true)}
                                />
                            </div>
                            
                            <input 
                                type="text" 
                                value={currentPlayer.name} 
                                onChange={(e) => updatePlayer(currentPlayer.id, { name: e.target.value })}
                                className="text-3xl font-bold text-white tracking-wide bg-transparent text-center w-full outline-none focus:border-b border-purple-500 mb-1"
                            />
                            
                            <input 
                                type="text"
                                value={currentPlayer.role || 'Investigador'}
                                onChange={(e) => updatePlayer(currentPlayer.id, { role: e.target.value })}
                                className="text-xs text-gray-400 uppercase tracking-widest bg-transparent text-center w-full outline-none hover:text-white transition"
                            />
                        </div>
                        <div className="space-y-6">
                             <StatBar label="Pontos de Vida" current={currentPlayer.pv.current} max={currentPlayer.pv.max} color="#ef4444" entityId={currentPlayer.id} stat="pv" icon={Droplet} />
                             <StatBar label="Determinação" current={currentPlayer.pd.current} max={currentPlayer.pd.max} color="#3b82f6" entityId={currentPlayer.id} stat="pd" icon={AlertCircle} />
                             <StatBar label="Sanidade" current={currentPlayer.san.current} max={currentPlayer.san.max} color="#8b5cf6" entityId={currentPlayer.id} stat="san" icon={Brain} />
                             <div className="pt-6 border-t border-gray-700">
                                <h3 className="font-bold mb-3 flex items-center gap-2 text-gray-400 text-sm uppercase"><Skull size={16} /> Condições Atuais</h3>
                                <div className="flex flex-wrap gap-2">
                                    {(currentPlayer.conditions || []).length === 0 && <span className="text-gray-600 text-sm italic">Nenhuma condição afetando você.</span>}
                                    {conditions.map(cond => (
                                        <button key={cond.id} onClick={() => { const hasCondition = (currentPlayer.conditions || []).includes(cond.id); updatePlayer(currentPlayer.id, { conditions: hasCondition ? currentPlayer.conditions.filter(c => c !== cond.id) : [...(currentPlayer.conditions || []), cond.id] }); }} className={`px-3 py-2 rounded flex items-center gap-2 text-sm transition border ${(currentPlayer.conditions || []).includes(cond.id) ? 'bg-gray-700 border-gray-500 text-white shadow-md' : 'bg-transparent border-gray-700 text-gray-600 grayscale hover:grayscale-0 hover:text-white hover:border-gray-500'}`} style={{ borderColor: (currentPlayer.conditions || []).includes(cond.id) ? cond.color : undefined }}>
                                            <span>{cond.icon}</span>{cond.label}
                                        </button>
                                    ))}
                                </div>
                             </div>
                        </div>

                        {/* LISTA DE AMEAÇAS PARA O PLAYER (VISUALIZAÇÃO APENAS) */}
                         <div className="mt-8 pt-8 border-t border-gray-700">
                             <h3 className="text-sm font-bold text-red-400 uppercase mb-4 flex items-center gap-2"><Ghost size={16} /> Ameaças Conhecidas</h3>
                             {safeMonsters.length === 0 && <p className="text-gray-500 italic text-xs">Tudo parece calmo... por enquanto.</p>}
                             <div className="space-y-3">
                                {safeMonsters.map(monster => (
                                    <div key={monster.id} className="bg-gray-800/50 p-3 rounded border border-gray-700 flex items-center gap-3 opacity-80 hover:opacity-100 transition">
                                        <div className="w-10 h-10 rounded bg-gray-900 flex items-center justify-center text-xl overflow-hidden">
                                            {monster.image ? <img src={monster.image} alt={monster.name} className="w-full h-full object-cover" /> : monster.avatar}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-gray-300">{monster.name}</div>
                                            <div className="text-xs text-red-500 font-mono">PV: ??? / ???</div>
                                        </div>
                                    </div>
                                ))}
                             </div>
                         </div>
                    </>
                ) : <div className="text-center text-gray-500 mt-10">Personagem não encontrado nesta sessão.</div>}
            </div>
        </div>
      </div>
    </div>
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) {
    console.error("Erro capturado:", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-900 text-white flex flex-col items-center justify-center p-8">
          <h1 className="text-4xl font-bold mb-4">⚠ Erro Crítico no Sistema</h1>
          <p className="mb-4 text-xl">Ocorreu um erro que impediu o carregamento do jogo.</p>
          <div className="bg-black p-6 rounded-lg overflow-auto max-w-full w-full border border-red-500 shadow-2xl">
            <h3 className="font-bold text-red-400 mb-2">Mensagem de Erro:</h3>
            <pre className="text-sm font-mono mb-4 text-white whitespace-pre-wrap">{this.state.error && this.state.error.toString()}</pre>
          </div>
          <button onClick={() => window.location.reload()} className="mt-8 px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200 transition">Tentar Recarregar Página</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <OrdemParanormalRPG />
    </ErrorBoundary>
  );
}