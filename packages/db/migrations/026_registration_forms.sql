-- Migration 026: Registration forms + submissions
-- Term sign-up forms ("Vuxentennis Vår 2026"). Custom fields (text/select/etc.)
-- are stored as a JSONB array on the form. Submissions store user answers as
-- JSONB and can auto-assign the user to a target group.

CREATE TABLE registration_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,
    description TEXT,
    sport_type VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,   -- junior / adult / senior / camp / other
    season VARCHAR(64) NOT NULL,     -- "Vår 2026"

    target_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,

    -- [{ key, label, type: 'text'|'select'|'number'|'checkbox', options?: string[], required: bool }, ...]
    fields JSONB NOT NULL DEFAULT '[]',

    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('open', 'closed', 'draft')),
    max_submissions INT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_registration_forms_club ON registration_forms(club_id);
CREATE INDEX idx_registration_forms_open ON registration_forms(club_id, status)
    WHERE status = 'open';

CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES registration_forms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- { fieldKey: answerValue }
    answers JSONB NOT NULL DEFAULT '{}',

    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_to_group BOOLEAN NOT NULL DEFAULT FALSE,

    UNIQUE (form_id, user_id)  -- one submission per user per form
);

CREATE INDEX idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_user ON form_submissions(user_id);
