import { Router, Request, Response } from 'express';
import { store } from '../store.js';
import crypto from 'crypto';

export const registrationFormRoutes = Router();
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const getName = (id: string) => store.users.find(u => u.id === id)?.full_name ?? 'Okänd';
const getEmail = (id: string) => store.users.find(u => u.id === id)?.email ?? '';

function enrichForm(f: any) {
  const subs = store.formSubmissions.filter(s => s.form_id === f.id);
  const group = f.target_group_id ? store.groups.find(g => g.id === f.target_group_id) : null;
  return {
    ...f,
    submission_count: subs.length,
    assigned_count: subs.filter(s => s.assigned_to_group).length,
    target_group_name: group?.name ?? null,
    spots_remaining: f.max_submissions ? f.max_submissions - subs.length : null,
  };
}

// GET /api/registration-forms?clubId=...
registrationFormRoutes.get('/', (req: Request, res: Response) => {
  const { clubId, status, category } = req.query;
  let forms = [...store.registrationForms];
  if (clubId) forms = forms.filter(f => f.club_id === clubId);
  if (status) forms = forms.filter(f => f.status === status);
  if (category) forms = forms.filter(f => f.category === category);
  res.json({ success: true, data: forms.map(enrichForm) });
});

// GET /api/registration-forms/:id — form detail + all submissions
registrationFormRoutes.get('/:id', (req: Request, res: Response) => {
  const f = store.registrationForms.find(f => f.id === req.params.id);
  if (!f) { res.status(404).json({ success: false, error: 'Form not found' }); return; }

  const subs = store.formSubmissions
    .filter(s => s.form_id === f.id)
    .map(s => ({
      ...s,
      user_name: getName(s.user_id),
      user_email: getEmail(s.user_id),
    }));

  res.json({ success: true, data: { ...enrichForm(f), submissions: subs } });
});

// POST /api/registration-forms — create a new form
// Automatically creates a group with the form title + links it
registrationFormRoutes.post('/', (req: Request, res: Response) => {
  const { clubId, title, description, sportType, category, season, targetGroupId, parentGroupId, fields, maxSubmissions } = req.body;
  if (!clubId || !title) { res.status(400).json({ success: false, error: 'clubId and title required' }); return; }

  // Auto-create a group named after the form title
  let groupId = targetGroupId;
  if (!groupId) {
    const autoGroup = store.createGroup({
      club_id: clubId, name: title,
      category: category || 'other', sport_type: sportType || 'padel',
      parent_group_id: parentGroupId || null,
      notes: `Auto-skapad från formulär: ${title}`,
    });
    groupId = autoGroup.id;
  }

  const form = {
    id: uid(), club_id: clubId, title, description: description || null,
    sport_type: sportType || 'padel', category: category || 'adult',
    season: season || '', target_group_id: groupId,
    fields: fields || [], status: 'open' as const,
    max_submissions: maxSubmissions || null,
    created_at: now(), updated_at: now(),
  };
  store.registrationForms.push(form);
  res.status(201).json({ success: true, data: enrichForm(form) });
});

// PATCH /api/registration-forms/:id — edit form
registrationFormRoutes.patch('/:id', (req: Request, res: Response) => {
  const f = store.registrationForms.find(f => f.id === req.params.id);
  if (!f) { res.status(404).json({ success: false, error: 'Form not found' }); return; }

  if (req.body.title !== undefined) f.title = req.body.title;
  if (req.body.description !== undefined) f.description = req.body.description;
  if (req.body.sportType !== undefined) f.sport_type = req.body.sportType;
  if (req.body.category !== undefined) f.category = req.body.category;
  if (req.body.season !== undefined) f.season = req.body.season;
  if (req.body.targetGroupId !== undefined) f.target_group_id = req.body.targetGroupId;
  if (req.body.fields !== undefined) f.fields = req.body.fields;
  if (req.body.status !== undefined) f.status = req.body.status;
  if (req.body.maxSubmissions !== undefined) f.max_submissions = req.body.maxSubmissions;
  f.updated_at = now();

  res.json({ success: true, data: enrichForm(f) });
});

// POST /api/registration-forms/:id/submit — member submits the form
registrationFormRoutes.post('/:id/submit', (req: Request, res: Response) => {
  const f = store.registrationForms.find(f => f.id === req.params.id);
  if (!f) { res.status(404).json({ success: false, error: 'Form not found' }); return; }
  if (f.status !== 'open') { res.status(409).json({ success: false, error: 'Form is closed' }); return; }

  const { userId, answers } = req.body;
  if (!userId) { res.status(400).json({ success: false, error: 'userId required' }); return; }

  // Check if already submitted
  if (store.formSubmissions.find(s => s.form_id === f.id && s.user_id === userId)) {
    res.status(409).json({ success: false, error: 'Already submitted' }); return;
  }

  // Check max submissions
  const currentCount = store.formSubmissions.filter(s => s.form_id === f.id).length;
  if (f.max_submissions && currentCount >= f.max_submissions) {
    res.status(409).json({ success: false, error: 'Form is full' }); return;
  }

  // Auto-assign to the form's target group
  let assignedToGroup = false;
  if (f.target_group_id) {
    const group = store.groups.find(g => g.id === f.target_group_id);
    if (group && !group.player_ids.includes(userId)) {
      group.player_ids.push(userId);
      group.updated_at = now();
    }
    assignedToGroup = true;

    // Also add to parent master category if one exists
    if (group?.parent_group_id) {
      const parent = store.groups.find(g => g.id === group.parent_group_id);
      if (parent && !parent.player_ids.includes(userId)) {
        parent.player_ids.push(userId);
        parent.updated_at = now();
      }
    }
  }

  const sub = {
    id: uid(), form_id: f.id, user_id: userId,
    answers: answers || {}, submitted_at: now(), assigned_to_group: assignedToGroup,
  };
  store.formSubmissions.push(sub);

  const groupName = f.target_group_id ? store.groups.find(g => g.id === f.target_group_id)?.name : null;
  res.status(201).json({ success: true, data: { ...sub, user_name: getName(userId), auto_assigned_group: groupName } });
});

// POST /api/registration-forms/:id/assign-all — assign all unassigned submissions to the target group
registrationFormRoutes.post('/:id/assign-all', (req: Request, res: Response) => {
  const f = store.registrationForms.find(f => f.id === req.params.id);
  if (!f) { res.status(404).json({ success: false, error: 'Form not found' }); return; }

  const groupId = req.body.groupId || f.target_group_id;
  const group = store.groups.find(g => g.id === groupId);
  if (!group) { res.status(404).json({ success: false, error: 'Target group not found' }); return; }

  const unassigned = store.formSubmissions.filter(s => s.form_id === f.id && !s.assigned_to_group);
  let count = 0;

  for (const sub of unassigned) {
    // Add player to group if not already there
    if (!group.player_ids.includes(sub.user_id)) {
      group.player_ids.push(sub.user_id);
    }
    sub.assigned_to_group = true;
    count++;
  }

  group.updated_at = now();
  res.json({ success: true, data: { assigned: count, group_name: group.name, total_players: group.player_ids.length } });
});

// POST /api/registration-forms/:id/assign-one — assign a single submission
registrationFormRoutes.post('/:id/assign-one', (req: Request, res: Response) => {
  const { submissionId, groupId } = req.body;
  const sub = store.formSubmissions.find(s => s.id === submissionId);
  if (!sub) { res.status(404).json({ success: false, error: 'Submission not found' }); return; }

  const f = store.registrationForms.find(f => f.id === req.params.id);
  const gid = groupId || f?.target_group_id;
  const group = store.groups.find(g => g.id === gid);
  if (!group) { res.status(404).json({ success: false, error: 'Group not found' }); return; }

  if (!group.player_ids.includes(sub.user_id)) group.player_ids.push(sub.user_id);
  sub.assigned_to_group = true;
  group.updated_at = now();

  res.json({ success: true, data: { user_name: getName(sub.user_id), group_name: group.name } });
});
