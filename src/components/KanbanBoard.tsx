"use client";

import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Building2, GripVertical, MapPin, Plus, Trash2, X, ExternalLink, FileText, Loader2, Save, PenSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import { authedFetch } from "@/lib/authedFetch";

type Stage = "Saved" | "Applied" | "Interview" | "Rejected";
const STAGES: Stage[] = ["Saved", "Applied", "Interview", "Rejected"];

interface KanbanTask {
  id: string; // local or key representation
  _id?: string; // MongoDB ObjectID
  title: string;
  company: string;
  location: string;
  stage: Stage;
  order: number;
  notes?: string;
  applyUrl?: string;
  createdAt?: string;
}

const DEFAULT_MOCK_APPS: KanbanTask[] = [
  { id: "task-1", _id: "task-1", title: "Senior Frontend Engineer", company: "Stripe", location: "Remote", stage: "Saved", order: 0, notes: "Resume uploaded, waiting to submit.", applyUrl: "https://stripe.com/jobs" },
  { id: "task-2", _id: "task-2", title: "Product Engineer", company: "Linear", location: "San Francisco, CA", stage: "Saved", order: 1, notes: "Coffee chat scheduled with Lead Designer next Tuesday.", applyUrl: "https://linear.app/careers" },
  { id: "task-3", _id: "task-3", title: "Staff Software Engineer", company: "Vercel", location: "Remote", stage: "Applied", order: 0, notes: "Applied via referral on Vercel portal.", applyUrl: "https://vercel.com/careers" },
  { id: "task-4", _id: "task-4", title: "Fullstack Developer", company: "Discord", location: "San Francisco, CA", stage: "Interview", order: 0, notes: "Passed screening. Technical panel round scheduled on July 15th.", applyUrl: "https://discord.com/careers" },
];

export function KanbanBoard() {
  const { user, isDemoMode } = useAuth();
  
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBrowser, setIsBrowser] = useState(false);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAddStage, setSelectedAddStage] = useState<Stage>("Saved");
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);

  // Form Fields for Adding / Editing
  const [formTitle, setFormTitle] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formApplyUrl, setFormApplyUrl] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStage, setFormStage] = useState<Stage>("Saved");

  const [savingForm, setSavingForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setIsBrowser(true);
  }, []);

  const fetchApplications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await authedFetch(`/api/tracker?userId=${user.uid}`);
      const data = await res.json();
      
      if (data.success) {
        if (data.isDemo) {
          // Load from LocalStorage
          const savedLocal = localStorage.getItem("hikari_demo_applications");
          if (savedLocal) {
            setTasks(JSON.parse(savedLocal));
          } else {
            // Seed default mock cards
            localStorage.setItem("hikari_demo_applications", JSON.stringify(DEFAULT_MOCK_APPS));
            setTasks(DEFAULT_MOCK_APPS);
          }
        } else {
          // MongoDB cards mapping
          const mappedTasks = data.applications.map((app: any) => ({
            ...app,
            id: app._id,
          }));
          setTasks(mappedTasks);
        }
      }
    } catch (e) {
      console.error("Failed to load applications:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isBrowser) {
      fetchApplications();
    }
  }, [user, isBrowser]);

  const getTasksByStage = (stage: Stage) => {
    return tasks
      .filter((t) => t.stage === stage)
      .sort((a, b) => a.order - b.order);
  };

  const persistTasksUpdate = async (updatedItems: KanbanTask[], fullUpdatedList: KanbanTask[]) => {
    if (isDemoMode) {
      localStorage.setItem("hikari_demo_applications", JSON.stringify(fullUpdatedList));
      return;
    }

    try {
      await Promise.all(
        updatedItems.map((item) =>
          authedFetch("/api/tracker", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: item._id || item.id,
              stage: item.stage,
              order: item.order,
            }),
          })
        )
      );
    } catch (e) {
      console.error("Failed to save reordered cards to database:", e);
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceStage = source.droppableId as Stage;
    const destStage = destination.droppableId as Stage;

    const movedTask = tasks.find((t) => (t._id || t.id) === draggableId);
    if (!movedTask) return;

    // Moving within the same column
    if (sourceStage === destStage) {
      const columnTasks = getTasksByStage(sourceStage);
      const [removed] = columnTasks.splice(source.index, 1);
      columnTasks.splice(destination.index, 0, removed);

      const updatedColumnTasks = columnTasks.map((t, idx) => ({
        ...t,
        order: idx,
      }));

      const remainingTasks = tasks.filter((t) => t.stage !== sourceStage);
      const finalTasks = [...remainingTasks, ...updatedColumnTasks];
      setTasks(finalTasks);
      persistTasksUpdate(updatedColumnTasks, finalTasks);
    } else {
      // Moving between different columns
      const sourceTasks = getTasksByStage(sourceStage);
      const destTasks = getTasksByStage(destStage);

      const [removed] = sourceTasks.splice(source.index, 1);
      const updatedRemoved = { ...removed, stage: destStage };
      destTasks.splice(destination.index, 0, updatedRemoved);

      const updatedSourceTasks = sourceTasks.map((t, idx) => ({ ...t, order: idx }));
      const updatedDestTasks = destTasks.map((t, idx) => ({ ...t, order: idx }));

      const remainingTasks = tasks.filter(
        (t) => t.stage !== sourceStage && t.stage !== destStage
      );
      const finalTasks = [...remainingTasks, ...updatedSourceTasks, ...updatedDestTasks];
      setTasks(finalTasks);
      persistTasksUpdate([...updatedSourceTasks, ...updatedDestTasks], finalTasks);
    }
  };

  const handleOpenAddModal = (stage: Stage) => {
    setSelectedAddStage(stage);
    setFormStage(stage);
    setFormTitle("");
    setFormCompany("");
    setFormLocation("");
    setFormApplyUrl("");
    setFormNotes("");
    setIsAddModalOpen(true);
  };

  const handleAddApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formCompany || !formLocation) return;
    setSavingForm(true);

    const payload = {
      userId: user.uid,
      title: formTitle,
      company: formCompany,
      location: formLocation,
      stage: formStage,
      applyUrl: formApplyUrl,
      notes: formNotes,
    };

    try {
      const res = await authedFetch("/api/tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        if (data.isDemo) {
          const generatedId = `demo-task-${Date.now()}`;
          const newApp: KanbanTask = {
            ...payload,
            id: generatedId,
            _id: generatedId,
            order: getTasksByStage(formStage).length,
          };
          const newTasksList = [...tasks, newApp];
          setTasks(newTasksList);
          localStorage.setItem("hikari_demo_applications", JSON.stringify(newTasksList));
        } else {
          const newApp = {
            ...data.application,
            id: data.application._id,
          };
          setTasks([...tasks, newApp]);
        }
        setIsAddModalOpen(false);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to add application");
    } finally {
      setSavingForm(false);
    }
  };

  const handleOpenDetailModal = (task: KanbanTask) => {
    setSelectedTask(task);
    setFormTitle(task.title);
    setFormCompany(task.company);
    setFormLocation(task.location);
    setFormApplyUrl(task.applyUrl || "");
    setFormNotes(task.notes || "");
    setFormStage(task.stage);
    setIsEditing(false);
    setIsDetailModalOpen(true);
  };

  const handleUpdateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setSavingForm(true);

    const taskId = selectedTask._id || selectedTask.id;
    const payload = {
      id: taskId,
      title: formTitle,
      company: formCompany,
      location: formLocation,
      applyUrl: formApplyUrl,
      notes: formNotes,
      stage: formStage,
    };

    try {
      const res = await authedFetch("/api/tracker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        // Stage changed as part of edit
        const stageChanged = selectedTask.stage !== formStage;
        
        let updatedTasksList = tasks.map((t) => {
          if ((t._id || t.id) === taskId) {
            return {
              ...t,
              title: formTitle,
              company: formCompany,
              location: formLocation,
              applyUrl: formApplyUrl,
              notes: formNotes,
              stage: formStage,
            };
          }
          return t;
        });

        // Recalculate ordering if the stage shifted
        if (stageChanged) {
          const oldStageTasks = updatedTasksList
            .filter((t) => t.stage === selectedTask.stage)
            .map((t, idx) => ({ ...t, order: idx }));
          const newStageTasks = updatedTasksList
            .filter((t) => t.stage === formStage)
            .map((t, idx) => ({ ...t, order: idx }));
          const otherStageTasks = updatedTasksList.filter(
            (t) => t.stage !== selectedTask.stage && t.stage !== formStage
          );
          updatedTasksList = [...otherStageTasks, ...oldStageTasks, ...newStageTasks];
        }

        setTasks(updatedTasksList);

        if (data.isDemo) {
          localStorage.setItem("hikari_demo_applications", JSON.stringify(updatedTasksList));
        }

        setIsDetailModalOpen(false);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to update application");
    } finally {
      setSavingForm(false);
    }
  };

  const handleDeleteApplication = async () => {
    if (!selectedTask) return;
    if (!confirm(`Are you sure you want to remove ${selectedTask.title} at ${selectedTask.company}?`)) return;
    setSavingForm(true);

    const taskId = selectedTask._id || selectedTask.id;

    try {
      const res = await authedFetch(`/api/tracker?id=${taskId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        const remainingTasks = tasks.filter((t) => (t._id || t.id) !== taskId);
        
        // Recalculate ordering indexes for remaining items in the stage
        const updatedStageTasks = remainingTasks
          .filter((t) => t.stage === selectedTask.stage)
          .map((t, idx) => ({ ...t, order: idx }));
        
        const otherStageTasks = remainingTasks.filter((t) => t.stage !== selectedTask.stage);
        const finalTasksList = [...otherStageTasks, ...updatedStageTasks];
        
        setTasks(finalTasksList);

        if (data.isDemo) {
          localStorage.setItem("hikari_demo_applications", JSON.stringify(finalTasksList));
        }

        setIsDetailModalOpen(false);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete application");
    } finally {
      setSavingForm(false);
    }
  };

  if (!isBrowser || loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-muted-foreground text-sm font-medium animate-pulse">Loading workspace board...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex h-full gap-6 overflow-x-auto pb-8 scrollbar-thin">
          {STAGES.map((columnId) => {
            const columnTasks = getTasksByStage(columnId);

            return (
              <div
                key={columnId}
                className="w-80 flex-shrink-0 flex flex-col bg-secondary/30 rounded-2xl border border-border p-4 shadow-sm"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4 px-1.5">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-sm text-foreground tracking-tight">{columnId}</h3>
                    <span className="text-[10px] font-bold bg-secondary border border-border text-muted-foreground px-2 py-0.5 rounded-full">
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Add application button */}
                  <button
                    onClick={() => handleOpenAddModal(columnId)}
                    className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title={`Add new application to ${columnId}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Droppable Column Area */}
                <Droppable droppableId={columnId}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 min-h-[300px] overflow-y-auto max-h-[60vh] space-y-3 rounded-xl p-1.5 transition-colors duration-250 ${
                        snapshot.isDraggingOver ? "bg-primary/5 border border-dashed border-primary/20" : ""
                      }`}
                    >
                      {columnTasks.length === 0 ? (
                        <div className="h-32 flex flex-col items-center justify-center border border-dashed border-border/50 rounded-xl text-center px-4">
                          <span className="text-[10px] text-muted-foreground font-semibold">Drop applications here</span>
                        </div>
                      ) : (
                        columnTasks.map((task, index) => (
                          <Draggable
                            key={task._id || task.id}
                            draggableId={task._id || task.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                onClick={() => handleOpenDetailModal(task)}
                                className={`bg-card text-card-foreground p-4 rounded-xl border transition-all cursor-pointer group/card select-none ${
                                  snapshot.isDragging
                                    ? "shadow-lg border-primary/25 scale-[1.03] z-50 ring-2 ring-primary/5"
                                    : "border-border shadow-sm hover:border-primary/20 hover:shadow-md"
                                }`}
                              >
                                <div className="flex items-start gap-2.5">
                                  {/* Drag Handle */}
                                  <div
                                    {...provided.dragHandleProps}
                                    className="mt-0.5 text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
                                    onClick={(e) => e.stopPropagation()} // avoid opening modal on handle drag click
                                  >
                                    <GripVertical className="w-4 h-4" />
                                  </div>

                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm mb-1.5 text-foreground truncate group-hover/card:text-primary transition-colors">
                                      {task.title}
                                    </h4>
                                    <div className="space-y-1">
                                      <div className="flex items-center text-xs text-muted-foreground truncate">
                                        <Building2 className="w-3.5 h-3.5 mr-1.5 shrink-0 text-muted-foreground/75" />
                                        {task.company}
                                      </div>
                                      <div className="flex items-center text-xs text-muted-foreground truncate">
                                        <MapPin className="w-3.5 h-3.5 mr-1.5 shrink-0 text-muted-foreground/75" />
                                        {task.location}
                                      </div>
                                    </div>

                                    {/* Small indicator if notes are present */}
                                    {task.notes && (
                                      <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                                        <FileText className="w-3 h-3 text-muted-foreground/80" />
                                        <span className="truncate">Notes attached</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* MODAL 1: ADD APPLICATION */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl w-full max-w-md p-6 relative shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <h3 className="font-bold text-lg text-foreground">Add New Application</h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddApplication} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Role Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Frontend Engineer"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-secondary/30 border border-border h-10 px-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/45 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Company</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Stripe"
                      value={formCompany}
                      onChange={(e) => setFormCompany(e.target.value)}
                      className="w-full bg-secondary/30 border border-border h-10 px-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/45 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Location</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SF, CA or Remote"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      className="w-full bg-secondary/30 border border-border h-10 px-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/45 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Column Stage</label>
                  <select
                    value={formStage}
                    onChange={(e) => setFormStage(e.target.value as Stage)}
                    className="w-full bg-secondary/30 border border-border h-10 px-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 appearance-none cursor-pointer"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Application URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://company.com/apply"
                    value={formApplyUrl}
                    onChange={(e) => setFormApplyUrl(e.target.value)}
                    className="w-full bg-secondary/30 border border-border h-10 px-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/45 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Notes (Optional)</label>
                  <textarea
                    placeholder="Interview dates, tech stack notes, key contacts..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full bg-secondary/30 border border-border h-24 p-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/45 resize-none transition-all"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 h-11 bg-secondary text-secondary-foreground rounded-xl text-sm font-semibold hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingForm}
                    className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all cursor-pointer"
                  >
                    {savingForm ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Add Opportunity"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: CARD DETAILS & EDITING */}
      <AnimatePresence>
        {isDetailModalOpen && selectedTask && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 relative shadow-2xl space-y-4"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start pb-2 border-b border-border">
                <div className="min-w-0 pr-8">
                  <div className="text-[10px] font-bold text-primary bg-primary/5 border border-primary/10 rounded-full px-2.5 py-0.5 inline-block mb-1.5">
                    {formStage}
                  </div>
                  <h3 className="font-bold text-xl text-foreground truncate">
                    {isEditing ? "Edit Application" : selectedTask.title}
                  </h3>
                </div>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors absolute top-4 right-4 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              {isEditing ? (
                <form onSubmit={handleUpdateApplication} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Role Title</label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full bg-secondary/30 border border-border h-10 px-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Company</label>
                      <input
                        type="text"
                        required
                        value={formCompany}
                        onChange={(e) => setFormCompany(e.target.value)}
                        className="w-full bg-secondary/30 border border-border h-10 px-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Location</label>
                      <input
                        type="text"
                        required
                        value={formLocation}
                        onChange={(e) => setFormLocation(e.target.value)}
                        className="w-full bg-secondary/30 border border-border h-10 px-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Column Stage</label>
                    <select
                      value={formStage}
                      onChange={(e) => setFormStage(e.target.value as Stage)}
                      className="w-full bg-secondary/30 border border-border h-10 px-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 appearance-none cursor-pointer"
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Application URL</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={formApplyUrl}
                      onChange={(e) => setFormApplyUrl(e.target.value)}
                      className="w-full bg-secondary/30 border border-border h-10 px-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Notes</label>
                    <textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="w-full bg-secondary/30 border border-border h-28 p-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 resize-none transition-all"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 h-11 bg-secondary text-secondary-foreground rounded-xl text-sm font-semibold hover:bg-secondary/80 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={savingForm}
                      className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all cursor-pointer"
                    >
                      {savingForm ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-5">
                  {/* Read-Only Details */}
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Building2 className="w-4 h-4 mr-2 text-muted-foreground/80 shrink-0" />
                      <span className="font-medium text-foreground mr-1">Company:</span>
                      {selectedTask.company}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 mr-2 text-muted-foreground/80 shrink-0" />
                      <span className="font-medium text-foreground mr-1">Location:</span>
                      {selectedTask.location}
                    </div>
                    {selectedTask.applyUrl && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <ExternalLink className="w-4 h-4 mr-2 text-muted-foreground/80 shrink-0" />
                        <span className="font-medium text-foreground mr-1">Apply URL:</span>
                        <a
                          href={selectedTask.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 truncate"
                        >
                          {selectedTask.applyUrl}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Notes Card */}
                  <div className="bg-secondary/30 rounded-xl p-4 border border-border/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                      Pipeline Notes
                    </span>
                    {selectedTask.notes ? (
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {selectedTask.notes}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No notes added. Click edit to add notes.</p>
                    )}
                  </div>

                  {/* Actions Drawer */}
                  <div className="flex gap-2 pt-2 border-t border-border/50">
                    <button
                      onClick={handleDeleteApplication}
                      disabled={savingForm}
                      className="h-11 px-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-destructive/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                    
                    <div className="flex-1" />

                    <button
                      onClick={() => setIsEditing(true)}
                      className="h-11 px-6 bg-primary text-primary-foreground rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                    >
                      <PenSquare className="w-4 h-4" />
                      <span>Edit details</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
