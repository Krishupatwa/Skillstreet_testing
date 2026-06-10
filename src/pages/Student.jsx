import { useEffect, useMemo, useState, useCallback } from 'react';

import { collection, addDoc, query, where, orderBy, onSnapshot, updateDoc, deleteDoc, doc, increment } from 'firebase/firestore';
import { db } from '../firebase.js';
import FileManager from '../components/FileManager.jsx';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const CATEGORY_LABELS = {
  design: 'Design',
  tech: 'Tech',
  content: 'Content',
  sales: 'Sales'
};

const SKILL_OPTIONS = [
  'Figma',
  'React',
  'Node.js',
  'Python',
  'Canva',
  'Writing',
  'SEO',
  'Sales',
  'UI/UX',
  'Data Analysis',
  'Video Editing',
  'Social Media'
];

const getSubmissionTime = (submission) => {
  const value = submission.submittedAt;
  if (!value) return 0;
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return 0;
};

const sortSubmissions = (items) => [...items].sort((a, b) => getSubmissionTime(b) - getSubmissionTime(a));

const visibleSubmissions = (items) => items.filter((submission) => !submission.deletedByStudent);

const getHiddenSubmissionStorageKey = (uid) => `hiddenSubmissions:${uid}`;
const getSubmissionBackupStorageKey = (uid) => `studentSubmissions:${uid}`;

const readHiddenSubmissionIds = (uid) => {
  if (!uid || typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(getHiddenSubmissionStorageKey(uid)) || '[]');
  } catch (error) {
    console.error('Hidden submission read error:', error);
    return [];
  }
};

const writeHiddenSubmissionIds = (uid, ids) => {
  if (!uid || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getHiddenSubmissionStorageKey(uid), JSON.stringify([...new Set(ids)]));
  } catch (error) {
    console.error('Hidden submission write error:', error);
  }
};

const readSubmissionBackups = (uid) => {
  if (!uid || typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(getSubmissionBackupStorageKey(uid)) || '[]');
  } catch (error) {
    console.error('Submission backup read error:', error);
    return [];
  }
};

const writeSubmissionBackups = (uid, items) => {
  if (!uid || typeof window === 'undefined') return;
  try {
    const byId = new Map();
    items.forEach((item) => {
      if (item?.id) byId.set(item.id, item);
    });
    window.localStorage.setItem(getSubmissionBackupStorageKey(uid), JSON.stringify([...byId.values()]));
  } catch (error) {
    console.error('Submission backup write error:', error);
  }
};

const mergeSubmissions = (...groups) => {
  const byId = new Map();
  groups.flat().forEach((submission) => {
    if (submission?.id) byId.set(submission.id, submission);
  });
  return sortSubmissions(visibleSubmissions([...byId.values()]));
};

const formatSubmissionDate = (submission) => {
  const time = getSubmissionTime(submission);
  return time ? new Date(time).toLocaleString() : 'Just now';
};

export default function Student({ user }) {
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [viewingTaskDescription, setViewingTaskDescription] = useState(null);
  const [activeSubmitTab, setActiveSubmitTab] = useState('link');
  const [studentName, setStudentName] = useState(user.displayName || '');
  const [linkValue, setLinkValue] = useState('');
  const [textValue, setTextValue] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [toast, setToast] = useState({ message: '', visible: false });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('All');
  const [activeView, setActiveView] = useState('browse');
  const [editingSubmission, setEditingSubmission] = useState(null);
  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [editSubmitTab, setEditSubmitTab] = useState('link');
  const [editLinkValue, setEditLinkValue] = useState('');
  const [editTextValue, setEditTextValue] = useState('');
  const [editSelectedFiles, setEditSelectedFiles] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingSubmissionId, setDeletingSubmissionId] = useState('');
  const [deletingAllSubmissions, setDeletingAllSubmissions] = useState(false);
  const [hiddenSubmissionIds, setHiddenSubmissionIds] = useState(() => readHiddenSubmissionIds(user.uid));
  const [submissionBackups, setSubmissionBackups] = useState(() => readSubmissionBackups(user.uid));

  const [downloadUrls, setDownloadUrls] = useState({}); // { [fileId]: url }

  const taskCategories = ['All', 'Design', 'Tech', 'Content', 'Sales'];


  useEffect(() => {
    const taskQuery = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const hiddenIds = readHiddenSubmissionIds(user.uid);
    setHiddenSubmissionIds(hiddenIds);
    const backups = readSubmissionBackups(user.uid);
    setSubmissionBackups(backups);
    setSubmissions(mergeSubmissions(backups).filter((submission) => !new Set(hiddenIds).has(submission.id)));
    const subsQuery = query(
      collection(db, 'submissions'),
      where('studentId', '==', user.uid)
    );

    const unsubscribeTasks = onSnapshot(
      taskQuery,
      (snapshot) => {
        const nextTasks = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((t) => !t.deleted && !t.isDeleted);

        setTasks(nextTasks);
        setLoading(false);
      },
      (error) => {
        console.error('Task fetch error:', error);
        setLoading(false);
      }
    );

    const unsubscribeSubs = onSnapshot(
      subsQuery,
      (snapshot) => {
        const hiddenIdSet = new Set(readHiddenSubmissionIds(user.uid));
        const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const currentBackups = readSubmissionBackups(user.uid);
        const merged = mergeSubmissions(items, currentBackups).filter((submission) => !hiddenIdSet.has(submission.id));
        setSubmissionBackups(currentBackups);
        setSubmissions(merged);
      },
      (error) => {
        console.error('Submission fetch error:', error);
      }
    );

    return () => {
      unsubscribeTasks();
      unsubscribeSubs();
    };
  }, [user.uid]);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (currentFilter === 'All') return true;
        return task.categoryLabel === currentFilter;
      }).filter((task) => {
        const submittedTaskIds = new Set(submissions.map((sub) => sub.taskId));
        return !submittedTaskIds.has(task.id);
      }),
    [tasks, currentFilter, submissions]
  );

  const showToast = (message) => {
    setToast({ message, visible: true });
    window.clearTimeout(window.toastTimer);
    window.toastTimer = window.setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3200);
  };

  const fetchDownloadUrl = useCallback((fileId) => {
    if (!fileId) return null;

    if (downloadUrls[fileId]) return downloadUrls[fileId];

    const downloadUrl = `${API_BASE_URL}/api/files/download/${fileId}`;
    setDownloadUrls((current) => ({ ...current, [fileId]: downloadUrl }));
    return downloadUrl;
  }, [downloadUrls]);


  const openTaskModal = (task) => {
    setActiveTask(task);
    setActiveSubmitTab('link');
    setLinkValue('');
    setTextValue('');
    setSelectedFiles([]);
  };

  const closeTaskModal = () => {
    setActiveTask(null);
  };

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    const MAX_FILES = 5;
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

    console.log('handleFileSelect called with files:', files);

    if (selectedFiles.length + files.length > MAX_FILES) {
      showToast(`Maximum ${MAX_FILES} files allowed per submission.`);
      return;
    }

    for (const file of files) {
      if (file.size >= MAX_FILE_SIZE) {
        showToast(`File "${file.name}" must be less than 20MB.`);
        continue;
      }

      try {
        console.log('Uploading file:', file.name);
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/api/upload`, {
          method: 'POST',
          body: formData,
        });

        console.log('Upload response status:', response.status);

        if (!response.ok) {
          let errorData = null;
          try {
            errorData = await response.json();
          } catch (e) {
            // ignore non-json errors
          }
          console.error('Upload failed:', errorData || { status: response.status });
          const reason = errorData?.message || errorData?.error || `HTTP ${response.status}`;
          const details = errorData?.details;
          throw new Error(details ? `${reason} - ${details}` : reason);
        }

        const data = await response.json();
        console.log('Upload successful:', data);
        setSelectedFiles((current) => [
          ...current,
          {
            name: file.name,
            type: file.type,
            size: file.size,
            fileId: data.fileId,
            bucketId: data.bucketId,
            dataUrl: data.fileUrl,
          }

        ]);
        showToast(`"${file.name}" uploaded successfully`);
      } catch (error) {
        console.error('Upload error:', error);
        showToast(`Cannot upload a file right now: ${error?.message || 'unknown error'}`);
      }
    }
    event.target.value = null;
  };

  const handleEditFileSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    const MAX_FILES = 5;
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

    if (editSelectedFiles.length + files.length > MAX_FILES) {
      showToast(`Maximum ${MAX_FILES} files allowed per submission.`);
      return;
    }

    for (const file of files) {
      if (file.size >= MAX_FILE_SIZE) {
        showToast(`File "${file.name}" must be less than 20MB.`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/api/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          let errorData = null;
          try {
            errorData = await response.json();
          } catch (e) {}
          const reason = errorData?.message || errorData?.error || `HTTP ${response.status}`;
          const details = errorData?.details;
          throw new Error(details ? `${reason} - ${details}` : reason);
        }

        const data = await response.json();
        setEditSelectedFiles((current) => [
          ...current,
          {
            name: file.name,
            type: file.type,
            size: file.size,
            fileId: data.fileId,
            bucketId: data.bucketId,
            dataUrl: data.fileUrl,

          }
        ]);
      } catch (error) {
        console.error('Upload error:', error);
        showToast(`Cannot upload a file right now: ${error?.message || 'unknown error'}`);
      }
    }
    event.target.value = null;
  };

  const removeFile = (index) => {
    setSelectedFiles((current) => current.filter((_, idx) => idx !== index));
  };

  const removeEditFile = (index) => {
    setEditSelectedFiles((current) => current.filter((_, idx) => idx !== index));
  };

  const openEditSubmission = (submission) => {
    setEditingSubmission(submission);
    setEditSubmitTab(submission.type || 'link');
    setEditLinkValue(submission.url || '');
    setEditTextValue(submission.text || '');
    setEditSelectedFiles(submission.files || []);
  };

  const closeEditSubmission = () => {
    setEditingSubmission(null);
    setEditSubmitTab('link');
    setEditLinkValue('');
    setEditTextValue('');
    setEditSelectedFiles([]);
  };

  const openViewSubmission = (submission) => {
    setViewingSubmission(submission);
  };

  const closeViewSubmission = () => {
    setViewingSubmission(null);
  };

  const submitTaskEntry = async () => {
    if (submitting) return;
    if (!activeTask) return;
    if (!studentName.trim()) {
      showToast('Please enter your name.');
      return;
    }
    if (activeSubmitTab === 'link' && !linkValue.trim()) {
      showToast('Please provide a submission link.');
      return;
    }
    if (activeSubmitTab === 'text' && !textValue.trim()) {
      showToast('Please add submission text.');
      return;
    }
    if (activeSubmitTab === 'file' && selectedFiles.length === 0) {
      showToast('Please upload at least one file.');
      return;
    }

    setSubmitting(true);
    try {
      const submittedAt = new Date().toISOString();
      const companyId = activeTask.companyId || activeTask.ownerId || activeTask.userId || '';
      const submissionData = {
        taskId: activeTask.id,
        taskTitle: activeTask.title,
        companyId,
        companyName: activeTask.companyName,
        studentId: user.uid,
        studentEmail: user.email,
        studentName: studentName.trim(),
        type: activeSubmitTab,
        url: activeSubmitTab === 'link' ? linkValue.trim() : '',
        text: activeSubmitTab === 'text' ? textValue.trim() : '',
        files: activeSubmitTab === 'file'
          ? selectedFiles.map((f) => ({
              name: f.name,
              type: f.type,
              size: f.size,
              fileId: f.fileId,
              ...(f.bucketId ? { bucketId: f.bucketId } : {}),
            }))
          : [],
        submittedAt
      };

      const submissionRef = await addDoc(collection(db, 'submissions'), submissionData);
      const savedSubmission = { id: submissionRef.id, ...submissionData };

      const nextHiddenIds = hiddenSubmissionIds.filter((id) => id !== submissionRef.id);
      setHiddenSubmissionIds(nextHiddenIds);
      writeHiddenSubmissionIds(user.uid, nextHiddenIds);

      const nextBackups = mergeSubmissions([savedSubmission], submissionBackups);
      setSubmissionBackups(nextBackups);
      writeSubmissionBackups(user.uid, nextBackups);

      setSubmissions((current) => {
        if (current.some((submission) => submission.id === submissionRef.id)) return current;
        return mergeSubmissions([savedSubmission], current);
      });

      setTasks((current) =>
        current.map((task) =>
          task.id === activeTask.id ? { ...task, participants: (task.participants || 0) + 1 } : task
        )
      );

      try {
        await updateDoc(doc(db, 'tasks', activeTask.id), {
          participants: increment(1)
        });
      } catch (error) {
        console.error('Participant count update error:', error);
      }

      showToast('Submission sent successfully.');
      closeTaskModal();
    } catch (error) {
      console.error('Submit error:', error);
      showToast('Unable to submit right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateSubmissionEntry = async () => {
    if (!editingSubmission) return;
    if (editSubmitTab === 'link' && !editLinkValue.trim()) {
      showToast('Please provide a submission link.');
      return;
    }
    if (editSubmitTab === 'text' && !editTextValue.trim()) {
      showToast('Please add submission text.');
      return;
    }
    if (editSubmitTab === 'file' && editSelectedFiles.length === 0) {
      showToast('Please upload at least one file.');
      return;
    }

    setSavingEdit(true);
    try {
      const updateData = {
        type: editSubmitTab,
        url: editSubmitTab === 'link' ? editLinkValue.trim() : '',
        text: editSubmitTab === 'text' ? editTextValue.trim() : '',
        files: editSubmitTab === 'file'
          ? editSelectedFiles.map((f) => ({
              name: f.name,
              type: f.type,
              size: f.size,
              fileId: f.fileId,
              ...(f.bucketId ? { bucketId: f.bucketId } : {}),
            }))
          : [],
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'submissions', editingSubmission.id), updateData);

      setSubmissions((current) =>
        sortSubmissions(
          current.map((submission) =>
            submission.id === editingSubmission.id ? { ...submission, ...updateData } : submission
          )
        )
      );
      const nextBackups = mergeSubmissions(
        submissionBackups.map((submission) =>
          submission.id === editingSubmission.id ? { ...submission, ...updateData } : submission
        )
      );
      setSubmissionBackups(nextBackups);
      writeSubmissionBackups(user.uid, nextBackups);
      setViewingSubmission((current) =>
        current?.id === editingSubmission.id ? { ...current, ...updateData } : current
      );
      showToast('Submission updated successfully.');
      closeEditSubmission();
    } catch (error) {
      console.error('Update submission error:', error);
      showToast('Unable to update submission right now.');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteSubmissionEntry = async (submission) => {
    if (!window.confirm('Delete this submission permanently?')) return;

    const nextHiddenIds = [...hiddenSubmissionIds, submission.id];
    setHiddenSubmissionIds(nextHiddenIds);
    writeHiddenSubmissionIds(user.uid, nextHiddenIds);
    setSubmissions((current) => current.filter((item) => item.id !== submission.id));
    const nextBackups = submissionBackups.filter((item) => item.id !== submission.id);
    setSubmissionBackups(nextBackups);
    writeSubmissionBackups(user.uid, nextBackups);
    setViewingSubmission((current) => (current?.id === submission.id ? null : current));
    setEditingSubmission((current) => (current?.id === submission.id ? null : current));
    setTasks((current) =>
      current.map((task) =>
        task.id === submission.taskId ? { ...task, participants: Math.max((task.participants || 1) - 1, 0) } : task
      )
    );

    setDeletingSubmissionId(submission.id);
    try {
      let firestoreDeleted = false;
      try {
        await updateDoc(doc(db, 'submissions', submission.id), {
          deletedByStudent: true,
          deletedAt: new Date().toISOString()
        });
        firestoreDeleted = true;
      } catch (error) {
        console.error('Submission soft delete update error:', error);
      }

      try {
        await deleteDoc(doc(db, 'submissions', submission.id));
        firestoreDeleted = true;
      } catch (error) {
        console.error('Submission hard delete error:', error);
      }

      if (!firestoreDeleted) {
        throw new Error('Firestore did not allow this submission to be deleted.');
      }

      try {
        await updateDoc(doc(db, 'tasks', submission.taskId), {
          participants: increment(-1)
        });
      } catch (error) {
        console.error('Participant count delete update error:', error);
      }

      showToast('Submission deleted.');
    } catch (error) {
      console.error('Delete submission error:', error);
      showToast('Submission hidden from your list.');
    } finally {
      setDeletingSubmissionId('');
    }
  };

  const deleteAllSubmissions = async () => {
    if (submissions.length === 0) return;
    if (!window.confirm('Delete all of your submissions permanently?')) return;

    const submissionsToDelete = [...submissions];
    const taskDeleteCounts = submissionsToDelete.reduce((counts, submission) => {
      if (!submission.taskId) return counts;
      return { ...counts, [submission.taskId]: (counts[submission.taskId] || 0) + 1 };
    }, {});

    const submissionIds = submissionsToDelete.map((submission) => submission.id);
    const nextHiddenIds = [...hiddenSubmissionIds, ...submissionIds];
    setHiddenSubmissionIds(nextHiddenIds);
    writeHiddenSubmissionIds(user.uid, nextHiddenIds);
    setSubmissions([]);
    setSubmissionBackups([]);
    writeSubmissionBackups(user.uid, []);
    setViewingSubmission(null);
    setEditingSubmission(null);
    setTasks((current) =>
      current.map((task) => {
        const deletedCount = taskDeleteCounts[task.id] || 0;
        if (!deletedCount) return task;
        return { ...task, participants: Math.max((task.participants || 0) - deletedCount, 0) };
      })
    );

    setDeletingAllSubmissions(true);
    try {
      await Promise.all(
        submissionsToDelete.map(async (submission) => {
          let firestoreDeleted = false;
          try {
            await updateDoc(doc(db, 'submissions', submission.id), {
              deletedByStudent: true,
              deletedAt: new Date().toISOString()
            });
            firestoreDeleted = true;
          } catch (error) {
            console.error('Submission soft delete update error:', error);
          }

          try {
            await deleteDoc(doc(db, 'submissions', submission.id));
            firestoreDeleted = true;
          } catch (error) {
            console.error('Submission hard delete error:', error);
          }

          if (!firestoreDeleted) {
            throw new Error(`Firestore did not allow submission ${submission.id} to be deleted.`);
          }
        })
      );

      await Promise.all(
        Object.entries(taskDeleteCounts).map(([taskId, deletedCount]) =>
          updateDoc(doc(db, 'tasks', taskId), {
            participants: increment(-deletedCount)
          }).catch((error) => {
            console.error('Participant count bulk delete update error:', error);
          })
        )
      );

      showToast('All submissions deleted.');
    } catch (error) {
      console.error('Delete all submissions error:', error);
      showToast('All submissions hidden from your list.');
    } finally {
      setDeletingAllSubmissions(false);
    }
  };

  const studentSubmissionCount = submissions.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-950 to-black text-white pt-28 sm:pt-24 py-10 px-4 sm:px-6 lg:px-8">

      <div className="mx-auto max-w-7xl space-y-10">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-sm p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-orange-300">Student Dashboard</p>
              <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold">Explore company tasks and submit your work</h1>
              <p className="mt-2 max-w-2xl text-slate-300">Only students can see tasks here. Companies will receive your submissions privately.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 text-center">
              <div className="rounded-3xl bg-blue-900/60 border border-blue-800/60 px-4 sm:px-6 py-4 sm:py-5">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-300">Available tasks</div>
                <div className="mt-3 text-2xl sm:text-3xl font-bold text-white">{tasks.length}</div>
              </div>
              <div className="rounded-3xl bg-blue-900/60 border border-blue-800/60 px-4 sm:px-6 py-4 sm:py-5">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-300">Your submissions</div>
                <div className="mt-3 text-2xl sm:text-3xl font-bold text-white">{studentSubmissionCount}</div>
              </div>
            </div>
          </div>
        </section>



        <section className="rounded-[1.5rem] border border-white/10 bg-white/5 backdrop-blur-sm p-6 shadow-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl sm:text-2xl font-semibold">Browse tasks</h2>
            <div className="flex flex-wrap gap-2">
              {taskCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition ${currentFilter === category ? 'bg-orange-500 text-slate-950' : 'bg-blue-900/60 border border-blue-800/60 text-white hover:bg-blue-800'}`}
                  onClick={() => setCurrentFilter(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
{loading ? (
              <div className="col-span-3 rounded-3xl border border-blue-800/60 bg-blue-900/30 p-8 text-center text-slate-300">Loading tasks…</div>
            ) : filteredTasks.length === 0 ? (
              <div className="col-span-3 rounded-3xl border border-dashed border-blue-800/60 bg-blue-900/30 p-8 text-center text-slate-300">No tasks match this filter yet.</div>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="group rounded-3xl border border-blue-800/60 bg-blue-900/30 p-6 shadow-sm transition duration-200 hover:bg-blue-800/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="rounded-full bg-blue-900/60 border border-blue-800/60 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white">{task.categoryLabel}</span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${task.urgent ? 'bg-orange-500 text-slate-950' : 'bg-blue-900/60 border border-blue-800/60 text-white'} group-hover:bg-orange-500 group-hover:text-slate-950`}
                    >
                      {task.deadline}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold">{task.title}</h3>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>{task.prize}</span>
                    <span>{task.participants || 0} submissions</span>
                    <span>{task.skills?.join(', ')}</span>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => openTaskModal(task)}
                      className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400"
                    >
                      Submit work
                    </button>
                    <span className="rounded-full bg-blue-900/60 border border-blue-800/60 px-3 py-2 text-xs text-white">{task.companyName}</span>
                    <button
                      type="button"
                      onClick={() => setViewingTaskDescription(task)}
                      className="rounded-2xl bg-orange-500 border border-blue-800/60 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400"
                    >
                      View description
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-white/10 bg-white/5 backdrop-blur-sm p-6 shadow-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl sm:text-2xl font-semibold">Your submissions</h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-blue-900/60 border border-blue-800/60 px-3 sm:px-4 py-2 text-xs sm:text-sm text-white">{studentSubmissionCount} results</span>
              {studentSubmissionCount > 0 ? (
                <button
                  type="button"
                  disabled={deletingAllSubmissions}
                  onClick={deleteAllSubmissions}
                  className="rounded-2xl border border-red-500/40 bg-red-500/10 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {deletingAllSubmissions ? 'Deleting all...' : 'Delete all'}
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-8 space-y-4">
            {submissions.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-blue-800/60 bg-blue-900/30 p-6 sm:p-8 text-center text-slate-300">You haven't submitted to any tasks yet.</div>
            ) : (
              submissions.map((submission) => (
                <div key={submission.id} className="rounded-3xl border border-blue-800/60 bg-blue-900/30 p-4 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-300">{submission.taskTitle}</div>
                      <div className="mt-1 text-base sm:text-lg font-semibold">{submission.type === 'link' ? 'Link submission' : submission.type === 'text' ? 'Text submission' : 'File submission'}</div>
                    </div>
                    <div className="rounded-full bg-blue-900/60 border border-blue-800/60 px-2 sm:px-3 py-1 sm:py-2 text-xs text-white">{formatSubmissionDate(submission)}</div>
                  </div>
                  <div className="mt-4 text-sm text-slate-300">
                    {submission.type === 'link' && (
                      <a href={submission.url} target="_blank" rel="noreferrer" className="text-orange-300 hover:text-orange-400 underline break-all">{submission.url}</a>
                    )}
                    {submission.type === 'text' && <p className="whitespace-pre-line">{submission.text}</p>}
                    {submission.type === 'file' && <p>{submission.files?.length || 0} file submitted</p>}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => openViewSubmission(submission)}
                      className="rounded-2xl bg-blue-900/60 border border-blue-800/60 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-blue-800"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditSubmission(submission)}
                      className="rounded-2xl border border-blue-800/60 bg-blue-900/30 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white transition hover:border-orange-400"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={deletingSubmissionId === submission.id}
                      onClick={() => deleteSubmissionEntry(submission)}
                      className="rounded-2xl border border-red-500/40 bg-red-500/10 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {deletingSubmissionId === submission.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {viewingTaskDescription ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={(event) => event.target === event.currentTarget && setViewingTaskDescription(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-blue-900/95 border border-blue-800/60 p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-orange-300">Task description</p>
                <h3 className="mt-3 text-2xl font-bold text-white">{viewingTaskDescription.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{viewingTaskDescription.companyName} - {viewingTaskDescription.categoryLabel}</p>
              </div>
              <button type="button" onClick={() => setViewingTaskDescription(null)} className="text-3xl text-slate-300">x</button>
            </div>
            <div className="mt-6 rounded-[1.5rem] bg-blue-900/60 border border-blue-800/60 p-5">
              <p className="whitespace-pre-line text-sm leading-6 text-slate-200">{viewingTaskDescription.description}</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-300">
              <span className="rounded-full bg-blue-900/60 border border-blue-800/60 px-3 py-2">{viewingTaskDescription.deadline} deadline</span>
              <span className="rounded-full bg-blue-900/60 border border-blue-800/60 px-3 py-2">{viewingTaskDescription.prize}</span>
              <span className="rounded-full bg-blue-900/60 border border-blue-800/60 px-3 py-2">{viewingTaskDescription.skills?.join(', ') || 'General'}</span>
            </div>
          </div>
        </div>
      ) : null}

      {activeTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={(event) => event.target === event.currentTarget && closeTaskModal()}>
          <div className="w-full max-w-3xl max-h-[calc(100vh-8rem)] overflow-y-auto rounded-[2rem] bg-blue-900/95 border border-blue-800/60 backdrop-blur-sm p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-orange-300">Submit work</p>
                <h3 className="mt-3 text-2xl font-bold">{activeTask.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{activeTask.companyName} · {activeTask.categoryLabel}</p>
              </div>
              <button type="button" onClick={closeTaskModal} className="text-3xl text-slate-300">×</button>
            </div>
            <div className="mt-6 rounded-[1.5rem] bg-blue-900/60 border border-blue-800/60 p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-blue-900/50 p-4 text-sm text-white">
                  <div className="text-xs uppercase tracking-[0.2em]">Deadline</div>
                  <div className="mt-2 text-white">{activeTask.deadline}</div>
                </div>
                <div className="rounded-2xl bg-blue-900/50 p-4 text-sm text-white">
                  <div className="text-xs uppercase tracking-[0.2em]">Reward</div>
                  <div className="mt-2 text-white">{activeTask.prize}</div>
                </div>
                <div className="rounded-2xl bg-blue-900/50 p-4 text-sm text-white">
                  <div className="text-xs uppercase tracking-[0.2em]">Current entries</div>
                  <div className="mt-2 text-white">{activeTask.participants || 0}</div>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Your name</label>
<input
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full rounded-2xl border-2 border-black bg-blue-900/50 px-4 py-3 text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                  placeholder="Your full name"
                  type="text"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {['link', 'text', 'file'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActiveSubmitTab(type)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeSubmitTab === type ? 'bg-orange-500 text-slate-950' : 'bg-blue-900/60 border border-blue-800/60 text-white hover:bg-blue-800'}`}
                  >
                    {type === 'link' ? 'Link' : type === 'text' ? 'Text' : 'File'}
                  </button>
                ))}
              </div>
              {activeSubmitTab === 'link' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Submission link</label>
<input
                    value={linkValue}
                    onChange={(e) => setLinkValue(e.target.value)}
                    placeholder="Paste a project link or portfolio URL"
                    className="w-full rounded-2xl border-2 border-black bg-blue-900/50 px-4 py-3 text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                    type="url"
                  />
                </div>
              )}
              {activeSubmitTab === 'text' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Submission details</label>
<textarea
                    rows={4}
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    placeholder="Describe your work and what you submitted."
                    className="w-full rounded-2xl border-2 border-black bg-blue-900/50 px-4 py-3 text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                  />
                </div>
              )}
              {activeSubmitTab === 'file' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-300">Upload files</label>
<label className="inline-flex w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-black border-dashed border-blue-800/60 bg-blue-900/30 px-4 py-6 text-center text-slate-300 transition hover:border-orange-400 hover:bg-blue-900/50">
                    <input type="file" multiple className="sr-only" onChange={handleFileSelect} />
                    Select files to upload
                  </label>
                  <p className="text-xs text-slate-400">File size must not exceed 20 MB.</p>
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blue-900/50 px-4 py-3 text-sm text-white">
                        <span className="break-all">{file.name}</span>
                        <div className="flex items-center gap-3">
                          {file.dataUrl ? (
                            <a href={file.dataUrl} target="_blank" rel="noreferrer" className="text-orange-300 hover:text-orange-200">
                              View
                            </a>
                          ) : null}
                          <button type="button" className="text-orange-300 hover:text-orange-200" onClick={() => removeFile(index)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submitTaskEntry}
                  className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
                <button
                  type="button"
                  onClick={closeTaskModal}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm text-slate-300 transition hover:border-orange-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingSubmission ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={(event) => event.target === event.currentTarget && closeEditSubmission()}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-slate-700 bg-slate-950/95 p-8 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-orange-300">Edit submission</p>
                <h3 className="mt-3 text-2xl font-bold text-white">{editingSubmission.taskTitle}</h3>
                <p className="mt-2 text-sm text-slate-400">Update the work you sent for this task.</p>
              </div>
              <button type="button" onClick={closeEditSubmission} className="text-3xl text-slate-400">x</button>
            </div>

            <div className="mt-6 space-y-5">
              <div className="flex flex-wrap gap-2">
                {['link', 'text', 'file'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEditSubmitTab(type)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${editSubmitTab === type ? 'bg-orange-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {type === 'link' ? 'Link' : type === 'text' ? 'Text' : 'File'}
                  </button>
                ))}
              </div>

              {editSubmitTab === 'link' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Submission link</label>
                  <input
                    value={editLinkValue}
                    onChange={(e) => setEditLinkValue(e.target.value)}
                    placeholder="Paste a project link or portfolio URL"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                    type="url"
                  />
                </div>
              )}

              {editSubmitTab === 'text' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Submission details</label>
                  <textarea
                    rows={5}
                    value={editTextValue}
                    onChange={(e) => setEditTextValue(e.target.value)}
                    placeholder="Describe your work and what you submitted."
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                  />
                </div>
              )}

              {editSubmitTab === 'file' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-300">Submitted files</label>
                  <label className="inline-flex w-full cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950 px-4 py-6 text-center text-slate-400 transition hover:border-orange-400 hover:bg-slate-900">
                    <input type="file" multiple className="sr-only" onChange={handleEditFileSelect} />
                    Add files
                  </label>
                  <p className="text-xs text-slate-400">File size must not exceed 20 MB.</p>
                  <div className="space-y-2">
                    {editSelectedFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-slate-300">
                        <span className="break-all">{file.name}</span>
                        <div className="flex gap-3">
                          {file.dataUrl ? (
                            <a href={file.dataUrl} target="_blank" rel="noreferrer" className="text-orange-300 hover:text-orange-200">
                              View
                            </a>
                          ) : null}
                          <button type="button" className="text-red-200 hover:text-red-100" onClick={() => removeEditFile(index)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={updateSubmissionEntry}
                  className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingEdit ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={closeEditSubmission}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm text-slate-300 transition hover:border-orange-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {viewingSubmission ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={(event) => event.target === event.currentTarget && closeViewSubmission()}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-slate-700 bg-slate-950/95 p-8 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-orange-300">View submission</p>
                <h3 className="mt-3 text-2xl font-bold text-white">{viewingSubmission.taskTitle}</h3>
                <p className="mt-2 text-sm text-slate-400">{formatSubmissionDate(viewingSubmission)}</p>
              </div>
              <button type="button" onClick={closeViewSubmission} className="text-3xl text-slate-400">x</button>
            </div>

            <div className="mt-6 rounded-[1.5rem] bg-slate-900/90 p-5 text-sm text-slate-300">
              {viewingSubmission.type === 'link' && (
                <a href={viewingSubmission.url} target="_blank" rel="noreferrer" className="break-all text-orange-300 underline hover:text-orange-400">
                  {viewingSubmission.url}
                </a>
              )}

              {viewingSubmission.type === 'text' && (
                <p className="whitespace-pre-line leading-6">{viewingSubmission.text}</p>
              )}

              {viewingSubmission.type === 'file' && (
                <div className="space-y-3">
                  {viewingSubmission.files?.length > 0 ? (

                    viewingSubmission.files.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950/80 p-4">
                        <span className="break-all">{file.name}</span>
                        {(() => {
                          const url = file.dataUrl || downloadUrls[file.fileId];
                          if (url) {
                            return (
                              <div className="flex gap-3">
                                <a href={url} target="_blank" rel="noreferrer" className="text-orange-300 hover:text-orange-200">
                                  View
                                </a>
                                <a href={url} download={file.name} className="text-slate-100 hover:text-white">
                                  Download
                                </a>
                              </div>
                            );
                          }

                          if (file.fileId) {
                            return (
                              <button
                                type="button"
                                onClick={() => fetchDownloadUrl(file.fileId)}
                                className="rounded-full px-3 py-2 text-xs font-semibold bg-orange-500/10 border border-orange-500/30 text-orange-300 hover:bg-orange-500/20"
                              >
                                Get download link
                              </button>
                            );
                          }

                          return null;
                        })()}
                      </div>
                    ))
                  ) : (
                    <p>No files are attached to this submission.</p>
                  )}

                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  openEditSubmission(viewingSubmission);
                  closeViewSubmission();
                }}
                className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={deletingSubmissionId === viewingSubmission.id}
                onClick={() => deleteSubmissionEntry(viewingSubmission)}
                className="rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deletingSubmissionId === viewingSubmission.id ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={closeViewSubmission}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm text-slate-300 transition hover:border-orange-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast.visible ? (
        <div className="fixed bottom-6 left-1/2 z-50 w-[min(90%,28rem)] -translate-x-1/2 rounded-2xl bg-slate-900/95 px-4 py-3 text-sm text-slate-100 shadow-2xl shadow-black/40">
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
