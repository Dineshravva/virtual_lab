import React, { useCallback, useEffect, useRef, useState } from 'react';
import RoomJoin from './components/RoomJoin';
import Toolbar from './components/Toolbar';
import PhysicsCanvas from './components/PhysicsCanvas';
import ConstraintPanel from './components/ConstraintPanel';
import ObjectPropertiesPanel from './components/ObjectPropertiesPanel';
import ApplyForcePanel from './components/ApplyForcePanel';
import GuidedLessonsPanel from './components/GuidedLessonsPanel';
import PredictionPanel from './components/PredictionPanel';
import QuizPanel from './components/QuizPanel';
import GlossaryPanel from './components/GlossaryPanel';
import AIAssistantPanel from './components/AIAssistantPanel';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import DataExportPanel from './components/DataExportPanel';
import TemplateLibraryPanel from './components/TemplateLibraryPanel';
import ExperimentLibrary from './components/ExperimentLibrary';
import ToastContainer from './components/ToastContainer';
import useSocket, { useSocketStatus } from './hooks/useSocket';
import { askLabAssistant, saveExperiment } from './services/api';

// Top-level component. Decides whether to show the room-join screen
// or the main lab interface, and wires the canvas to the sidebar.
function App() {
  const [roomName, setRoomName] = useState(null);
  const [bodies, setBodies] = useState([]);
  const [constraints, setConstraints] = useState([]);
  const [analyticsHistory, setAnalyticsHistory] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [gravityEnabled, setGravityEnabled] = useState(true);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [activeTool, setActiveTool] = useState('select');
  const [polygonPointCount, setPolygonPointCount] = useState(0);
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false
  });
  const [selectedBody, setSelectedBody] = useState(null);
  const [forcePreview, setForcePreview] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [libraryRefreshToken, setLibraryRefreshToken] = useState(0);
  const [activeLessonId, setActiveLessonId] = useState('pendulums');
  const [observeCount, setObserveCount] = useState(0);
  const canvasRef = useRef(null);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message, type = 'error') => {
    const id = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    setToasts((current) => [...current.slice(-3), { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  const socket = useSocket(roomName, notify);
  const connectionStatus = useSocketStatus(socket);

  const handleAddBox = useCallback(() => {
    if (canvasRef.current) canvasRef.current.addBox();
  }, []);
  const handleAddCircle = useCallback(() => {
    if (canvasRef.current) canvasRef.current.addCircle();
  }, []);
  const handleTogglePolygonTool = useCallback(() => {
    setActiveTool((current) => (current === 'polygon' ? 'select' : 'polygon'));
  }, []);
  const handleFinishPolygon = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.finishPolygon();
    setActiveTool('select');
  }, []);
  const handleCancelPolygon = useCallback(() => {
    if (canvasRef.current) canvasRef.current.cancelPolygon();
    setActiveTool('select');
  }, []);
  const handlePause = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.pause();
    setIsPaused(true);
  }, []);
  const handlePlay = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.play();
    setIsPaused(false);
    setObserveCount((current) => current + 1);
  }, []);
  const handleStep = useCallback(() => {
    if (canvasRef.current) canvasRef.current.step();
  }, []);
  const handleReset = useCallback(() => {
    if (canvasRef.current) canvasRef.current.reset();
  }, []);
  const handleDeleteSelected = useCallback(() => {
    if (canvasRef.current) canvasRef.current.deleteSelected();
  }, []);
  const handleUndo = useCallback(() => {
    if (canvasRef.current) canvasRef.current.undo();
  }, []);
  const handleRedo = useCallback(() => {
    if (canvasRef.current) canvasRef.current.redo();
  }, []);
  const handleToggleGrid = useCallback(() => {
    setShowGrid((current) => !current);
  }, []);
  const handleToggleGravity = useCallback(() => {
    const nextGravityEnabled = !gravityEnabled;
    setGravityEnabled(nextGravityEnabled);
    if (canvasRef.current) {
      canvasRef.current.setGravityEnabled(nextGravityEnabled);
    }
  }, [gravityEnabled]);
  const handleUpdateBodyProperties = useCallback((networkId, patch) => {
    if (canvasRef.current) {
      canvasRef.current.updateBodyProperties(networkId, patch);
    }
  }, []);

  const handleApplyToBody = useCallback((spec) => {
    if (!canvasRef.current || !spec) return;
    canvasRef.current.applyToBody(spec);
    if (spec && spec.mode === 'force') {
      notify(
        `Applied ${spec.magnitude.toFixed(1)} N at ${spec.angle.toFixed(0)} deg.`,
        'success'
      );
    } else if (spec && spec.mode === 'velocity') {
      notify(
        `Applied ${spec.magnitude.toFixed(1)} m/s at ${spec.angle.toFixed(0)} deg.`,
        'success'
      );
    }
  }, [notify]);
  const handleSetSimulationSpeed = useCallback((speed) => {
    setSimulationSpeed(speed);
    if (canvasRef.current) canvasRef.current.setTimeScale(speed);
  }, []);
  const handleAddConstraint = useCallback((type) => {
    if (type === 'pivot') {
      setActiveTool('pivot');
    } else if (activeTool === 'pivot') {
      setActiveTool('select');
    }
    if (canvasRef.current) canvasRef.current.addConstraint(type);
  }, [activeTool]);
  const handleRemoveConstraint = useCallback((constraintId) => {
    if (canvasRef.current) canvasRef.current.removeConstraint(constraintId);
  }, []);

  // Save the current scene to MongoDB via REST
  const handleSave = useCallback(async (name) => {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Experiment name is required.');
    }
    if (!canvasRef.current) {
      throw new Error('The physics canvas is not ready yet.');
    }
    const snapshot = canvasRef.current.getSnapshot();
    if (!snapshot.bodies.length) {
      throw new Error('Add at least one body before saving.');
    }
    await saveExperiment(trimmed, snapshot.bodies, snapshot.constraints);
  }, []);

  // Replace the current scene with a saved experiment
  const handleLoad = useCallback((exp) => {
    if (canvasRef.current) canvasRef.current.loadExperiment(exp);
  }, []);

  const handleLoadTemplate = useCallback((template) => {
    if (!template || !canvasRef.current) return;
    canvasRef.current.loadExperiment(template);
    setIsPaused(false);
  }, []);

  // Additive: used by Guided Lessons "Load Setup" so loading a lesson
  // doesn't wipe whatever the student already built on the canvas.
  const handleAddTemplate = useCallback((template) => {
    if (!template || !canvasRef.current) return;
    canvasRef.current.addTemplate(template);
    setIsPaused(false);
  }, []);

  const handleQuickSave = useCallback(async () => {
    if (!canvasRef.current) return;

    const snapshot = canvasRef.current.getSnapshot();
    if (!snapshot.bodies.length) {
      notify('Add at least one body before saving.', 'error');
      return;
    }

    const stamp = new Date()
      .toISOString()
      .replace('T', ' ')
      .replace(/\..+$/, '')
      .replace(/:/g, '-');
    const name = `Quick Save ${stamp}`;

    try {
      await saveExperiment(name, snapshot.bodies, snapshot.constraints);
      setLibraryRefreshToken((current) => current + 1);
      notify(`Saved ${name}.`, 'success');
    } catch (err) {
      const message =
        err.response && err.response.data && err.response.data.error
          ? err.response.data.error
          : err.message || 'Save failed. Please try again.';
      notify(message, 'error');
    }
  }, [notify]);

  const handleAskAssistant = useCallback(async (question, options) => {
    if (!canvasRef.current) {
      throw new Error('The physics canvas is not ready yet.');
    }
    const scene = {
      ...canvasRef.current.getSnapshot(),
      analytics: {
        bodies: bodies.map((body) => ({
          id: body.networkId,
          type: body.shapeType || (body.circleRadius ? 'circle' : 'box'),
          x: Number(body.position.x.toFixed(1)),
          y: Number(body.position.y.toFixed(1)),
          speed: Number(Math.hypot(body.velocity.x, body.velocity.y).toFixed(2)),
          mass: Number(body.mass.toFixed(2))
        }))
      }
    };
    const data = await askLabAssistant(question, scene, options);
    return data.answer;
  }, [bodies]);

  const downloadTextFile = useCallback((filename, content, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleExportJson = useCallback(() => {
    if (!canvasRef.current) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      roomName,
      scene: canvasRef.current.getSnapshot(),
      analytics: analyticsHistory
    };
    downloadTextFile(
      `virtual-lab-${roomName}-scene.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  }, [analyticsHistory, downloadTextFile, roomName]);

  const handleExportCsv = useCallback(() => {
    const rows = [
      ['time', 'average_velocity_px_per_tick', 'total_kinetic_energy'],
      ...analyticsHistory.map((point) => [point.t, point.v, point.ke])
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadTextFile(`virtual-lab-${roomName}-chart.csv`, csv, 'text/csv');
  }, [analyticsHistory, downloadTextFile, roomName]);

  useEffect(() => {
    const isTypingTarget = (target) => {
      const tag = target && target.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (target && target.isContentEditable)
      );
    };

    const onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      const isTyping = isTypingTarget(e.target);
      const hasModifier = e.ctrlKey || e.metaKey;

      if (hasModifier && key === 's') {
        e.preventDefault();
        handleQuickSave();
        return;
      }

      if (isTyping) return;

      if (hasModifier && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (hasModifier && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Shape and simulation shortcuts must not run when a modifier is held,
      // otherwise Ctrl+B (bookmark), Ctrl+Space etc. would fire lab actions.
      if (hasModifier) return;

      if (key === 'b') {
        handleAddBox();
        return;
      }
      if (key === 'c') {
        handleAddCircle();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPaused) {
          handlePlay();
        } else {
          handlePause();
        }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedBody) return;
        e.preventDefault();
        handleDeleteSelected();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleAddBox,
    handleAddCircle,
    handleDeleteSelected,
    handlePause,
    handlePlay,
    handleQuickSave,
    handleRedo,
    handleUndo,
    isPaused,
    selectedBody
  ]);

  if (!roomName) {
    return <RoomJoin onJoin={setRoomName} />;
  }

  return (
    <div className="h-screen flex flex-col bg-lab-bg text-gray-200">
      <Toolbar
        roomName={roomName}
        connectionStatus={connectionStatus}
        onAddBox={handleAddBox}
        onAddCircle={handleAddCircle}
        onTogglePolygonTool={handleTogglePolygonTool}
        onFinishPolygon={handleFinishPolygon}
        onCancelPolygon={handleCancelPolygon}
        onPause={handlePause}
        onPlay={handlePlay}
        onStep={handleStep}
        onReset={handleReset}
        onDeleteSelected={handleDeleteSelected}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onToggleGrid={handleToggleGrid}
        onToggleGravity={handleToggleGravity}
        onSetSimulationSpeed={handleSetSimulationSpeed}
        isPaused={isPaused}
        showGrid={showGrid}
        gravityEnabled={gravityEnabled}
        simulationSpeed={simulationSpeed}
        activeTool={activeTool}
        polygonPointCount={polygonPointCount}
        canUndo={historyState.canUndo}
        canRedo={historyState.canRedo}
        selectedBody={selectedBody}
      />
      <div className="flex flex-1 overflow-hidden max-lg:flex-col">
        <main className="flex-1 overflow-auto">
          <PhysicsCanvas
            ref={canvasRef}
            socket={socket}
            onBodiesUpdate={setBodies}
            onSelectionChange={setSelectedBody}
            onConstraintsUpdate={setConstraints}
            onHistoryChange={setHistoryState}
            showGrid={showGrid}
            gravityEnabled={gravityEnabled}
            onGravityChange={setGravityEnabled}
            simulationSpeed={simulationSpeed}
            activeTool={activeTool}
            onActiveToolChange={setActiveTool}
            onPolygonDraftChange={setPolygonPointCount}
            forcePreview={forcePreview}
          />
        </main>
        <aside className="w-80 bg-lab-panel border-l border-gray-800 overflow-y-auto flex-shrink-0
                          max-lg:w-full max-lg:max-h-80 max-lg:border-l-0 max-lg:border-t">
          <GuidedLessonsPanel
            onAddTemplate={handleAddTemplate}
            onLessonChange={setActiveLessonId}
          />
          <PredictionPanel
            activeLessonId={activeLessonId}
            observeCount={observeCount}
            onPlay={handlePlay}
          />
          <QuizPanel />
          <GlossaryPanel />
          <AIAssistantPanel onAsk={handleAskAssistant} />
          <ConstraintPanel
            constraints={constraints}
            activeTool={activeTool}
            onAddConstraint={handleAddConstraint}
            onRemoveConstraint={handleRemoveConstraint}
          />
          <ObjectPropertiesPanel
            selectedBody={selectedBody}
            onUpdate={handleUpdateBodyProperties}
          />
          <ApplyForcePanel
            selectedBody={selectedBody}
            onPreviewChange={setForcePreview}
            onApply={handleApplyToBody}
          />
          <AnalyticsDashboard
            bodies={bodies}
            onHistoryUpdate={setAnalyticsHistory}
          />
          <DataExportPanel
            onExportJson={handleExportJson}
            onExportCsv={handleExportCsv}
            hasChartData={analyticsHistory.length > 0}
          />
          <TemplateLibraryPanel onLoadTemplate={handleLoadTemplate} />
          <ExperimentLibrary
            onSave={handleSave}
            onLoad={handleLoad}
            onNotify={notify}
            refreshToken={libraryRefreshToken}
          />
        </aside>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
