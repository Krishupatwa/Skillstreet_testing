import { useEffect, useMemo, useState } from 'react';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, doc, getDoc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import FileManager from '../components/FileManager.jsx';

// If VITE_API_URL is not set, default to same-origin so Vite proxy (/api -> backend) works.
const API_BASE_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
  : '';

const SKILLS_LIST = [
  'Figma', 'React', 'Node.js', 'Python', 'Canva', 'Writing', 'SEO', 'Sales', 'UI/UX', 'Data Analysis', 'Video Editing', 'Social Media'
];

const CATEGORY_LABELS = {
  design: 'Design',
  tech: 'Tech',
  content: 'Content',
  sales: 'Sales'
};

const getTime = (value) => {
  if (!value) return 0;
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return 0;
};

const sortByNewest = (items, field) => [...items].sort((a, b) => getTime(b[field]) - getTime(a[field]));

const readHiddenSubmissionIds = (uid) => {
  if (!uid || typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(`hiddenSubmissions:${uid}`) || '[]');
  } catch (error) {
    console.error('Hidden submission read error:', error);
    return [];
  }
};

const visibleSubmissions = (items, uid) =>
  items.filter((submission) => {
    const hiddenIdSet = new Set(readHiddenSubmissionIds(uid));
    if (submission.deletedByStudent || hiddenIdSet.has(submission.id)) return false;
    return true;
  });

const mergeSubmissions = (items, uid) => {
  const byId = new Map();
  visibleSubmissions(items, uid).forEach((submission) => {
    byId.set(submission.id, submission);
  });
  return sortByNewest([...byId.values()], 'submittedAt');
};

const initialForm = {
  title: '',
  description: '',
  deadline: '7',
  maxWinners: '1',
  prize: '1500',
  category: 'design',
  urgent: 'no',
  skills: [],
  rewardTypes: []
};

export default function Company({ user }) {
  const [tasks, setTasks] = useState([]);
  const [companySubmissions, setCompanySubmissions] = useState([]);
  const [taskScopedSubmissions, setTaskScopedSubmissions] = useState([]);
  const [studentUsers, setStudentUsers] = useState({});
  const [formValues, setFormValues] = useState(initialForm);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [viewingTaskDescription, setViewingTaskDescription] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [selectedSubmissionFiles, setSelectedSubmissionFiles] = useState([]);
  const [paymentAdded, setPaymentAdded] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);
  const [toast, setToast] = useState({ message: '', visible: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const taskQuery = query(
      collection(db, 'tasks'),
      where('companyId', '==', user.uid)
    );
    const submissionsQuery = query(
      collection(db, 'submissions'),
      where('companyId', '==', user.uid)
    );

    const unsubscribeTasks = onSnapshot(
      taskQuery,
      (snapshot) => {
        const nextTasks = snapshot
          .docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((t) => !t.deleted && !t.isDeleted);
        setTasks(sortByNewest(nextTasks, 'createdAt'));
        setLoading(false);
      },
      (error) => {
        console.error('Task fetch error:', error);
        setLoading(false);
      }
    );

    const unsubscribeCompanySubmissions = onSnapshot(
      submissionsQuery,
      async (snapshot) => {
        const submissions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        console.log('Company submissions fetched:', submissions);
        setCompanySubmissions(submissions);

        // Fetch student user data for each submission
        const studentIds = [...new Set(submissions.map(s => s.studentId))];
        console.log('Student IDs to fetch:', studentIds);
        const studentData = {};
        await Promise.all(studentIds.map(async (studentId) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', studentId));
            if (userDoc.exists()) {
              studentData[studentId] = userDoc.data();
              console.log('Student data fetched for', studentId, ':', userDoc.data());
            } else {
              console.log('No student data found for', studentId);
            }
          } catch (error) {
            console.error('Error fetching student data for', studentId, ':', error);
          }
        }));
        console.log('Final student data:', studentData);
        setStudentUsers(studentData);
      },
      (error) => {
        console.error('Company submission fetch error:', error);
      }
    );

    return () => {
      unsubscribeTasks();
      unsubscribeCompanySubmissions();
    };
  }, [user.uid]);

  useEffect(() => {
    if (tasks.length === 0) {
      setTaskScopedSubmissions([]);
      return undefined;
    }

    const taskIds = tasks.map((task) => task.id);
    const unsubscribeByTask = taskIds.map((taskId) => {
      const submissionsQuery = query(
        collection(db, 'submissions'),
        where('taskId', '==', taskId)
      );

      return onSnapshot(
        submissionsQuery,
        (snapshot) => {
          const taskSubmissions = visibleSubmissions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })), user.uid);
          console.log('Task submissions for taskId', taskId, ':', taskSubmissions);
          setTaskScopedSubmissions((current) => {
            const otherTaskSubmissions = current.filter((submission) => submission.taskId !== taskId);
            return sortByNewest([...otherTaskSubmissions, ...taskSubmissions], 'submittedAt');
          });
        },
        (error) => {
          console.error('Submission fetch error:', error);
        }
      );
    });

    return () => {
      unsubscribeByTask.forEach((unsubscribe) => unsubscribe());
    };
  }, [tasks]);

  const submissions = useMemo(
    () => {
      const merged = mergeSubmissions([...companySubmissions, ...taskScopedSubmissions], user.uid);
      console.log('Merged submissions:', merged);
      console.log('Company submissions count:', companySubmissions.length);
      console.log('Task scoped submissions count:', taskScopedSubmissions.length);
      return merged;
    },
    [companySubmissions, taskScopedSubmissions, user.uid]
  );

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const selectedSubmissionTask = selectedSubmission
    ? tasks.find((task) => task.id === selectedSubmission.taskId)
    : null;
  const taskSubmissionCounts = useMemo(
    () =>
      submissions.reduce((counts, submission) => {
        if (!submission.taskId) return counts;
        return { ...counts, [submission.taskId]: (counts[submission.taskId] || 0) + 1 };
      }, {}),
    [submissions]
  );
  const taskSubmissions = useMemo(
    () => submissions.filter((submission) => submission.taskId === selectedTaskId),
    [submissions, selectedTaskId]
  );

  const showToast = (message) => {
    setToast({ message, visible: true });
    window.clearTimeout(window.toastTimer);
    window.toastTimer = window.setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3200);
  };

  const handleFileDownload = async (fileId, fileName) => {
    if (!fileId) {
      showToast('File not available for download.');
      return;
    }

    try {
      // Download from deployed backend (Railway) if configured.
      // Vite same-origin proxy can fail in production because the API may live on a different host.
      // Force Railway backend download endpoint.
      const base = 'https://web-production-906ef.up.railway.app';
      const response = await fetch(`${base}/api/files/download/${fileId}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Download failed (${response.status})${errorText ? `: ${errorText}` : ''}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName || 'download';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      showToast(`Download failed: ${error.message || 'unknown error'}`);
    }
  };

  const handleFormChange = (field, value) => {
    setFormValues((current) => ({ ...current, [field]: value }));
  };

  const toggleSkill = (skill) => {
    setFormValues((current) => ({
      ...current,
      skills: current.skills.includes(skill)
        ? current.skills.filter((item) => item !== skill)
        : [...current.skills, skill]
    }));
  };

  const toggleReward = (reward) => {
    setFormValues((current) => ({
      ...current,
      rewardTypes: current.rewardTypes.includes(reward)
        ? current.rewardTypes.filter((item) => item !== reward)
        : [...current.rewardTypes, reward]
    }));
  };

  const getPrizeInputValue = (prize) => {
    if (!prize) return '';
    const digits = String(prize).match(/\d+/g);
    return digits ? digits.join('') : String(prize).replace(/^Rs\s*/i, '');
  };

  const startEditingTask = (task) => {
    setEditingTaskId(task.id);
    setFormValues({
      title: task.title || '',
      description: task.description || '',
      deadline: String(parseInt(task.deadline, 10) || 7),
      maxWinners: String(task.maxWinners || 1),
      prize: getPrizeInputValue(task.prize),
      category: task.category || 'design',
      urgent: task.urgent ? 'yes' : 'no',
      skills: task.skills || [],
      rewardTypes: task.rewardTypes || []
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditingTask = () => {
    setEditingTaskId(null);
    setFormValues(initialForm);
  };

  const publishTask = async () => {
    if (!formValues.title.trim()) {
      showToast('Enter a task title.');
      return;
    }
    if (!formValues.description.trim()) {
      showToast('Enter a task description.');
      return;
    }

    setSaving(true);
    try {
      const createdAt = new Date().toISOString();
      const taskData = {
        title: formValues.title.trim(),
        description: formValues.description.trim(),
        deadline: `${formValues.deadline}d`,
        maxWinners: Number(formValues.maxWinners) || 1,
        prize: formValues.prize.trim() ? `₹${formValues.prize.trim()}` : 'Certificate',
        category: formValues.category,
        categoryLabel: CATEGORY_LABELS[formValues.category],
        urgent: formValues.urgent === 'yes',
        skills: formValues.skills.length ? formValues.skills : ['General'],
        rewardTypes: formValues.rewardTypes.length ? formValues.rewardTypes : [formValues.prize.trim() ? `₹${formValues.prize.trim()}` : 'Certificate'],
        companyId: user.uid,
        companyName: user.displayName || user.email || 'Company',
        participants: 0
      };

      if (editingTaskId) {
        const { participants, ...editableTaskData } = taskData;
        await updateDoc(doc(db, 'tasks', editingTaskId), {
          ...editableTaskData,
          updatedAt: serverTimestamp()
        });
        setTasks((current) =>
          sortByNewest(
            current.map((task) =>
              task.id === editingTaskId ? { ...task, ...editableTaskData, updatedAt: createdAt } : task
            ),
            'createdAt'
          )
        );
        setSelectedTaskId(editingTaskId);
        setEditingTaskId(null);
        setFormValues(initialForm);
        showToast('Task updated successfully.');
        return;
      }

      const taskRef = await addDoc(collection(db, 'tasks'), {
        ...taskData,
        createdAt: serverTimestamp()
      });

      setTasks((current) => {
        if (current.some((task) => task.id === taskRef.id)) return current;
        return sortByNewest([{ id: taskRef.id, ...taskData, createdAt }, ...current], 'createdAt');
      });
      setSelectedTaskId(taskRef.id);
      setFormValues(initialForm);
      showToast('Task published successfully. Students can now see it.');
    } catch (error) {
      console.error('Publish task error:', error);
      showToast('Unable to publish task right now.');
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (task) => {
    if (!window.confirm('Delete this task and its submissions permanently?')) return;

    const previousTasks = tasks;
    const previousCompanySubmissions = companySubmissions;
    const previousTaskScopedSubmissions = taskScopedSubmissions;

    // Hide immediately in UI (optimistic)
    setDeletingTaskId(task.id);
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setCompanySubmissions((current) => current.filter((submission) => submission.taskId !== task.id));
    setTaskScopedSubmissions((current) => current.filter((submission) => submission.taskId !== task.id));
    setViewingTaskDescription((current) => (current?.id === task.id ? null : current));
    if (selectedTaskId === task.id) setSelectedTaskId(null);
    if (editingTaskId === task.id) cancelEditingTask();

    try {
      // Soft-delete first so every dashboard that filters by deleted/isDeleted hides it instantly.
      // If soft-delete fails (permissions/doc missing), still proceed with hard delete.
      try {
        await updateDoc(doc(db, 'tasks', task.id), {
          deleted: true,
          isDeleted: true,
          deletedAt: serverTimestamp()
        });
      } catch (softError) {
        console.error('Soft-delete task step failed (continuing with hard delete):', softError);
      }

      let submissionResults = [];
      try {
        const submissionSnapshot = await getDocs(
          query(collection(db, 'submissions'), where('taskId', '==', task.id))
        );

        // Delete submissions (best-effort), but ALWAYS attempt deleting the task doc.
        submissionResults = await Promise.allSettled(
          submissionSnapshot.docs.map(async (submissionDoc) => {
            // Optional: mark submissions as deleted too
            try {
              await updateDoc(submissionDoc.ref, {
                deletedByStudent: true,
                deletedAt: serverTimestamp()
              });
            } catch (e) {
              // ignore; still hard delete below
            }
            return deleteDoc(submissionDoc.ref);
          })
        );
      } catch (subErr) {
        console.error('Delete task submissions fetch step failed (continuing with task delete):', subErr);
      }

      const submissionsFailed = submissionResults.length > 0 && submissionResults.some((r) => r.status === 'rejected');

      // Finally delete the task doc itself (this is the critical requirement)
      await deleteDoc(doc(db, 'tasks', task.id));

      showToast(submissionsFailed ? 'Task deleted (submissions cleanup may be delayed).' : 'Task deleted successfully.');
    } catch (error) {
      console.error('Delete task error:', error);

      // revert optimistic UI
      setTasks(previousTasks);
      setCompanySubmissions(previousCompanySubmissions);
      setTaskScopedSubmissions(previousTaskScopedSubmissions);

      const msg = error?.message ? String(error.message) : 'unknown error';
      showToast(`Unable to delete task right now: ${msg}`);
    } finally {
      setDeletingTaskId('');
    }
  };

  const openSelectSubmission = (submission) => {
    setSelectedSubmission(submission);
    setSelectedSubmissionFiles(submission.selectedFiles || []);
    setPaymentAdded(Boolean(submission.paymentAdded));
  };

  const closeSelectSubmission = () => {
    setSelectedSubmission(null);
    setSelectedSubmissionFiles([]);
    setPaymentAdded(false);
    setSavingSelection(false);
  };

  const handleSelectionFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    const MAX_FILES = 5;
    const MAX_FILE_SIZE = 20 * 1024 * 1024;

    if (selectedSubmissionFiles.length + files.length > MAX_FILES) {
      showToast(`Maximum ${MAX_FILES} files allowed for a selection.`);
      event.target.value = null;
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
          } catch (e) {
            // ignore non-json errors
          }
          const reason = errorData?.message || errorData?.error || `HTTP ${response.status}`;
          const details = errorData?.details;
          throw new Error(details ? `${reason} - ${details}` : reason);
        }

        const data = await response.json();
        setSelectedSubmissionFiles((current) => [
          ...current,
          {
            name: file.name,
            type: file.type,
            size: file.size,
            fileId: data.fileId,
            bucketId: data.bucketId,
            fileUrl: data.fileUrl,
          }
        ]);
        showToast(`"${file.name}" uploaded successfully.`);
      } catch (error) {
        console.error('Selection upload error:', error);
        showToast(`Cannot upload a file right now: ${error?.message || 'unknown error'}`);
      }
    }

    event.target.value = null;
  };

  const removeSelectionFile = (index) => {
    setSelectedSubmissionFiles((current) => current.filter((_, idx) => idx !== index));
  };

  const sendSelectionEmail = async (submission, task, selectionData) => {
    const rewardTypes = submission.rewardTypes || task?.rewardTypes || [];
    const uploadedFileText = selectionData.selectedFiles.length
      ? selectionData.selectedFiles
          .map((file, index) => [
            `${index + 1}. ${file.name}`,
            `Type: ${file.type || 'N/A'}`,
            `Size: ${file.size ? `${Math.round(file.size / 1024)} KB` : 'N/A'}`,
            `B2 File ID: ${file.fileId || 'N/A'}`,
            `B2 Bucket ID: ${file.bucketId || 'N/A'}`,
            `File URL: ${file.fileUrl || 'N/A'}`,
          ].join('\n'))
          .join('\n\n')
      : 'No files uploaded by company for this selection.';

    const studentSubmissionFiles = submission.files?.length
      ? submission.files
          .map((file, index) => [
            `${index + 1}. ${file.name}`,
            `Type: ${file.type || 'N/A'}`,
            `Size: ${file.size ? `${Math.round(file.size / 1024)} KB` : 'N/A'}`,
            `B2 File ID: ${file.fileId || 'N/A'}`,
            `B2 Bucket ID: ${file.bucketId || 'N/A'}`,
          ].join('\n'))
          .join('\n\n')
      : 'No files in the student submission.';

    const message = [
      'A company selected a student submission on SkillStreet.',
      '',
      'Company Details',
      `Company Name: ${user.displayName || user.email || 'N/A'}`,
      `Company Email: ${user.email || 'N/A'}`,
      `Company ID: ${user.uid || 'N/A'}`,
      '',
      'Student Details',
      `Student Name: ${submission.studentName || 'N/A'}`,
      `Student Email: ${submission.studentEmail || studentUsers[submission.studentId]?.email || 'N/A'}`,
      `Student ID: ${submission.studentId || 'N/A'}`,
      '',
      'Task Details',
      `Task Title: ${submission.taskTitle || task?.title || 'N/A'}`,
      `Task ID: ${submission.taskId || 'N/A'}`,
      `Category: ${task?.categoryLabel || task?.category || 'N/A'}`,
      `Deadline: ${task?.deadline || 'N/A'}`,
      '',
      'Rewards',
      `Reward Amount: ${submission.prize || task?.prize || 'N/A'}`,
      `Reward Types: ${rewardTypes.length ? rewardTypes.join(', ') : 'N/A'}`,
      `Payment Added: ${selectionData.paymentAdded ? 'Yes' : 'No'}`,
      '',
      'Student Submission',
      `Submission ID: ${submission.id || 'N/A'}`,
      `Submission Type: ${submission.type || 'N/A'}`,
      `Submitted At: ${submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : 'N/A'}`,
      submission.url ? `Submission Link: ${submission.url}` : '',
      submission.text ? `Submission Text: ${submission.text}` : '',
      '',
      'Student Uploaded Files',
      studentSubmissionFiles,
      '',
      'Company Uploaded Files For Selection',
      uploadedFileText,
      '',
      `Selected At: ${new Date(selectionData.selectedAt).toLocaleString()}`,
    ].filter((line) => line !== '').join('\n');

    const formData = new FormData();
    formData.append('_subject', `SkillStreet Selection: ${submission.studentName || 'Student'} - ${submission.taskTitle || 'Task'}`);
    formData.append('_captcha', 'false');
    formData.append('name', user.displayName || user.email || 'SkillStreet Company');
    formData.append('email', user.email || 'no-reply@skillstreet.local');
    formData.append('subject', 'Student submission selected');
    formData.append('message', message);

    const response = await fetch('https://formsubmit.co/ajax/support.skillstreet@gmail.com', {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Selection email could not be sent.');
    }
  };

  const saveSelectedSubmission = async () => {
    if (!selectedSubmission) return;

    setSavingSelection(true);
    try {
      const selectionData = {
        selectedByCompany: true,
        selectedAt: new Date().toISOString(),
        paymentAdded,
        selectedFiles: selectedSubmissionFiles.map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
          fileId: file.fileId,
          ...(file.bucketId ? { bucketId: file.bucketId } : {}),
          ...(file.fileUrl ? { fileUrl: file.fileUrl } : {}),
        })),
      };

      await updateDoc(doc(db, 'submissions', selectedSubmission.id), selectionData);
      await sendSelectionEmail(selectedSubmission, selectedSubmissionTask, selectionData);

      const updateLocalSubmission = (submission) =>
        submission.id === selectedSubmission.id ? { ...submission, ...selectionData } : submission;

      setCompanySubmissions((current) => current.map(updateLocalSubmission));
      setTaskScopedSubmissions((current) => current.map(updateLocalSubmission));
      setSelectedSubmission((current) => (current ? { ...current, ...selectionData } : current));
      showToast('Submission selected and sent to support successfully.');
      closeSelectSubmission();
    } catch (error) {
      console.error('Select submission error:', error);
      showToast(`Unable to complete selection right now: ${error?.message || 'unknown error'}`);
    } finally {
      setSavingSelection(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-950 to-black text-white pt-28 sm:pt-24 py-10 px-4 sm:px-6 lg:px-8">

      <div className="mx-auto max-w-7xl space-y-10">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-sm p-8 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-orange-300">Company Dashboard</p>
              <h1 className="mt-4 text-4xl font-extrabold">Manage your student challenges</h1>
              <p className="mt-2 max-w-2xl text-slate-300">Create tasks, track active student submissions, and keep your briefs private to your company.</p>
            </div>
            <div className="rounded-3xl bg-blue-900/60 border border-blue-800/60 px-6 py-4 text-sm text-white">
              <div>Posted tasks</div>
              <div className="mt-2 text-3xl font-bold text-white">{tasks.length}</div>
            </div>
          </div>
        </section>



        <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 backdrop-blur-sm p-6 sm:p-8 shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold">{editingTaskId ? 'Edit task' : 'Post a new task'}</h2>
              <p className="mt-2 text-sm text-slate-300">{editingTaskId ? 'Update the details students will see for this task.' : 'Share a challenge that only students can view and apply for.'}</p>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Task title</label>
                <input
                  type="text"
                  value={formValues.title}
                  onChange={(e) => handleFormChange('title', e.target.value)}
                  placeholder="Design a mobile landing page"
                  className="w-full rounded-2xl border border-white/10 bg-blue-900/50 px-4 py-3 text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Task description</label>
                <textarea
                  rows={4}
                  value={formValues.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="Add a short brief for students."
                  className="w-full rounded-2xl border border-white/10 bg-blue-900/50 px-4 py-3 text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Category</label>
                  <select
                    value={formValues.category}
                    onChange={(e) => handleFormChange('category', e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-blue-900/50 px-4 py-3 text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                  >
                    <option value="design">Design</option>
                    <option value="tech">Tech</option>
                    <option value="content">Content</option>
                    <option value="sales">Sales</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Deadline (days)</label>
                  <input
                    type="number"
                    min="1"
                    value={formValues.deadline}
                    onChange={(e) => handleFormChange('deadline', e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-blue-900/50 px-4 py-3 text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Reward amount</label>
                  <input
                    type="text"
                    value={formValues.prize}
                    onChange={(e) => handleFormChange('prize', e.target.value)}
                    placeholder="1500"
                    className="w-full rounded-2xl border border-white/10 bg-blue-900/50 px-4 py-3 text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Max winners</label>
                  <input
                    type="number"
                    min="1"
                    value={formValues.maxWinners}
                    onChange={(e) => handleFormChange('maxWinners', e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-blue-900/50 px-4 py-3 text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Urgent</label>
                  <select
                    value={formValues.urgent}
                    onChange={(e) => handleFormChange('urgent', e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-blue-900/50 px-4 py-3 text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Skills</label>
                  <div className="flex flex-wrap gap-2">
                    {SKILLS_LIST.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={`rounded-full px-3 py-1 text-sm transition ${formValues.skills.includes(skill) ? 'bg-orange-500 text-slate-950' : 'bg-blue-900/60 border border-blue-800/60 text-white hover:bg-blue-800'}`}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Rewards</label>
                <div className="flex flex-wrap gap-2">
                  {['💰 Cash Prize', '📜 Certificate', '🚀 Internship', '🏅 Digital Badge'].map((reward) => (
                    <button
                      key={reward}
                      type="button"
                      onClick={() => toggleReward(reward)}
                      className={`rounded-full px-3 py-1 text-sm transition ${formValues.rewardTypes.includes(reward) ? 'bg-orange-500 text-slate-950' : 'bg-blue-900/60 border border-blue-800/60 text-white hover:bg-blue-800'}`}
                    >
                      {reward}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={publishTask}
                disabled={saving}
                className="w-full rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {saving ? (editingTaskId ? 'Saving...' : 'Publishing...') : editingTaskId ? 'Save Task' : 'Publish Task'}
              </button>
              {editingTaskId ? (
                <button
                  type="button"
                  onClick={cancelEditingTask}
                  className="w-full rounded-2xl border border-blue-800/60 bg-blue-900/40 px-5 py-3 text-sm font-semibold text-white transition hover:border-orange-400"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 backdrop-blur-sm p-6 sm:p-8 shadow-xl">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold">Your posted tasks</h2>
                <p className="mt-2 text-sm text-slate-300">Only students can see and respond to these challenges.</p>
              </div>
              <div className="inline-flex items-center rounded-full bg-blue-900/60 border border-blue-800/60 px-4 py-2 text-sm text-white">
                {loading ? 'Loading...' : `${tasks.length} tasks posted`}
              </div>
            </div>
            <div className="space-y-4">
              {tasks.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-blue-800/60 bg-blue-900/30 p-6 text-center text-slate-300">
                  No company tasks yet. Publish one to make it visible to students.
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`w-full rounded-3xl border p-5 text-left transition ${selectedTaskId === task.id ? 'border-orange-400 bg-blue-900/60' : 'border-blue-800/60 bg-blue-900/30 hover:border-orange-400'}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm uppercase tracking-[0.2em] text-orange-300">{task.categoryLabel}</div>
                        <h3 className="mt-2 text-xl font-semibold">{task.title}</h3>
                      </div>
                      <span className="rounded-full bg-blue-900/60 border border-blue-800/60 px-3 py-1 text-sm text-white">{taskSubmissionCounts[task.id] || 0} submissions</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
                      <span>{task.deadline} deadline</span>
                      <span>{task.prize}</span>
                      <span>{task.urgent ? 'Urgent' : 'Normal'}</span>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-blue-900/60 border border-blue-800/60 px-3 py-2 text-xs text-white">{task.companyName}</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setViewingTaskDescription(task);
                        }}
                        className="rounded-2xl bg-blue-900/60 border border-blue-800/60 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-800"
                      >
                        View description
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          startEditingTask(task);
                        }}
                        className="rounded-2xl border border-blue-800/60 bg-blue-900/30 px-4 py-2 text-xs font-semibold text-white transition hover:border-orange-400"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={deletingTaskId === task.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteTask(task);
                        }}
                        className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {deletingTaskId === task.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedTask ? (
              <div className="mt-8 rounded-3xl border border-blue-800/60 bg-blue-900/30 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold">{selectedTask.title}</h3>
                    <p className="mt-1 text-sm text-slate-300">Submissions for this task</p>
                  </div>
                  <div className="rounded-full bg-blue-900/60 border border-blue-800/60 px-3 py-1 text-sm text-white">{taskSubmissions.length} submissions</div>
                </div>
                <div className="mt-6 space-y-4">
                  {taskSubmissions.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-blue-800/60 bg-blue-900/30 p-6 text-slate-300">No submissions yet. Students will see your task in their dashboard.</div>
                  ) : (
                    taskSubmissions.map((submission) => (
                      <div key={submission.id} className="rounded-3xl border border-blue-800/60 bg-blue-900/30 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm text-slate-300">{submission.studentName}</div>
                            <div className="text-lg font-semibold">{submission.type === 'link' ? 'Link submission' : submission.type === 'text' ? 'Text submission' : 'File submission'}</div>
                          </div>
                          <div className="text-xs text-slate-400">{new Date(submission.submittedAt).toLocaleString()}</div>
                        </div>
                        <div className="mt-3 text-sm text-slate-300">
                          {submission.type === 'link' && (
                            <a href={submission.url} target="_blank" rel="noreferrer" className="text-orange-300 hover:text-orange-400 underline">{submission.url}</a>
                          )}
                          {submission.type === 'text' && <p className="whitespace-pre-line">{submission.text}</p>}
                          {submission.type === 'file' && submission.files?.length ? (
                            <div className="mt-3 space-y-2">
                              {submission.files.map((file) => (
                                <div key={file.name} className="rounded-2xl bg-blue-900/50 p-3 text-sm text-slate-300">
                                  <div>{file.name}</div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-white/10 bg-white/5 backdrop-blur-sm p-6 sm:p-8 shadow-xl">
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold">Student Submissions</h2>
            <p className="mt-2 text-sm text-slate-300">View all student submissions with detailed information</p>
          </div>
          <div className="space-y-4">
            {submissions.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-blue-800/60 bg-blue-900/30 p-6 text-center text-slate-300">No submissions yet.</div>
            ) : (
              submissions.map((submission) => {
                const studentData = studentUsers[submission.studentId] || {};
                return (
                  <div key={submission.id} className="rounded-3xl border border-blue-800/60 bg-blue-900/30 p-4 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="rounded-full bg-orange-500/10 border border-orange-500/30 px-3 py-1 text-xs uppercase tracking-[0.16em] text-orange-300">{submission.type} submission</span>
                          {submission.selectedByCompany ? (
                            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs uppercase tracking-[0.16em] text-emerald-200">Selected</span>
                          ) : null}
                          <span className="text-xs text-slate-400">{new Date(submission.submittedAt).toLocaleString()}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">{submission.taskTitle}</h3>
                        <p className="text-sm text-slate-300 mt-1">Submitted by: {submission.studentName}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openSelectSubmission(submission)}
                        className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-orange-400"
                      >
                        Select
                      </button>
                    </div>

                    <div className="rounded-2xl bg-blue-800/40 border border-blue-700/50 p-4 mb-4">
                      <h4 className="text-sm font-semibold text-orange-300 mb-3">Student Information</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-slate-400">Name:</span>
                          <span className="ml-2 text-white">{studentData.displayName || submission.studentName || 'N/A'}</span>
                        </div>
                        
                        <div>
                          <span className="text-slate-400">Role:</span>
                          <span className="ml-2 text-white capitalize">{studentData.role || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Account Created:</span>
                          <span className="ml-2 text-white">{studentData.createdAt ? new Date(studentData.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>
                      {Object.keys(studentData).length > 0 && (
                        <div className="mt-3 text-xs text-slate-400">
                          Debug: Available fields: {Object.keys(studentData).join(', ')}
                        </div>
                      )}
                      {Object.keys(studentData).length === 0 && (
                        <div className="mt-3 text-xs text-slate-400">No detailed student data available in database</div>
                      )}
                    </div>

                    <div className="text-sm text-slate-300">
                      {submission.type === 'link' && (
                        <a href={submission.url} target="_blank" rel="noreferrer" className="text-orange-300 hover:text-orange-400 underline break-all">{submission.url}</a>
                      )}
                      {submission.type === 'text' && <p className="whitespace-pre-line">{submission.text}</p>}
                      {submission.type === 'file' && submission.files?.length ? (
                        <div className="mt-3 space-y-2">
                          {submission.files.map((file, index) => (
                            <div key={index} className="rounded-2xl bg-blue-900/50 p-3 text-sm text-slate-300">
                              <div className="flex items-center justify-between">
                                <div>{file.name}</div>
                                {file.fileId && (
                                  <button
                                    type="button"
                                    onClick={() => handleFileDownload(file.fileId, file.name)}
                                    className="rounded-xl bg-orange-500/10 border border-orange-500/30 px-3 py-1 text-xs font-semibold text-orange-300 hover:bg-orange-500/20 transition-all"
                                  >
                                    Download
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
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

      {selectedSubmission ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={(event) => event.target === event.currentTarget && closeSelectSubmission()}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-blue-900/95 border border-blue-800/60 p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-orange-300">Select submission</p>
                <h3 className="mt-3 text-2xl font-bold text-white">{selectedSubmission.taskTitle}</h3>
                <p className="mt-2 text-sm text-slate-300">Review the student and task details before saving the selection.</p>
              </div>
              <button type="button" onClick={closeSelectSubmission} className="text-3xl text-slate-300">x</button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Student name</label>
                <input
                  type="text"
                  readOnly
                  value={selectedSubmission.studentName || ''}
                  className="w-full rounded-2xl border border-white/10 bg-blue-900/50 px-4 py-3 text-white outline-none"
                />
              </div>
             
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-slate-300">Rewards</label>
              <textarea
                rows={5}
                readOnly
                value={[
                  `Reward amount: ${selectedSubmission.prize || selectedSubmissionTask?.prize || 'N/A'}`,
                  `Reward types: ${(selectedSubmission.rewardTypes || selectedSubmissionTask?.rewardTypes || []).join(', ') || 'N/A'}`,
                ].filter(Boolean).join('\n')}
                className="w-full rounded-2xl border border-white/10 bg-blue-900/50 px-4 py-3 text-white outline-none"
              />
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-sm font-medium text-slate-300">Upload files for this selection</label>
              <label className="inline-flex w-full cursor-pointer items-center justify-center rounded-2xl border border-dashed border-blue-800/60 bg-blue-900/30 px-4 py-6 text-center text-slate-300 transition hover:border-orange-400 hover:bg-blue-900/50">
                <input type="file" multiple className="sr-only" onChange={handleSelectionFileUpload} />
                Select files to upload
              </label>
              <p className="text-xs text-slate-400">File size must not exceed 20 MB.</p>
              <div className="space-y-2">
                {selectedSubmissionFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blue-900/50 px-4 py-3 text-sm text-white">
                    <span className="break-all">{file.name}</span>
                    <button type="button" className="text-orange-300 hover:text-orange-200" onClick={() => removeSelectionFile(index)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-800/60 bg-blue-900/30 p-4">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={paymentAdded}
                  onChange={(event) => setPaymentAdded(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-blue-800/60 bg-blue-900 text-orange-500 focus:ring-orange-400"
                />
                <span>Payment added for this selected task</span>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={savingSelection}
                onClick={saveSelectedSubmission}
                className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {savingSelection ? 'Saving...' : 'Save selection'}
              </button>
              {paymentAdded ? (
                <button
                  type="button"
                  onClick={() => showToast('Payment action is ready to connect.')}
                  className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                >
                  Pay
                </button>
              ) : null}
              <button
                type="button"
                onClick={closeSelectSubmission}
                className="rounded-2xl border border-blue-800/60 bg-blue-900/40 px-5 py-3 text-sm font-semibold text-white transition hover:border-orange-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast.visible ? (
        <div className="fixed bottom-6 left-1/2 z-50 w-[min(90%,28rem)] -translate-x-1/2 rounded-2xl bg-blue-900/95 border border-blue-800/60 backdrop-blur-sm px-4 py-3 text-sm text-white shadow-2xl">
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
