-- Migration 010: Link bookings to their recurrence rule + batch
-- * recurrence_rule_id  : the rule that generated this booking (null for one-offs)
-- * generation_batch_id : the apply-to-period invocation that created this booking,
--                        so "undo last apply" can soft-cancel an entire batch.

ALTER TABLE bookings
    ADD COLUMN recurrence_rule_id  UUID REFERENCES recurrence_rules(id) ON DELETE SET NULL,
    ADD COLUMN generation_batch_id UUID;

CREATE INDEX idx_bookings_recurrence_rule ON bookings(recurrence_rule_id)
    WHERE recurrence_rule_id IS NOT NULL;
CREATE INDEX idx_bookings_generation_batch ON bookings(generation_batch_id)
    WHERE generation_batch_id IS NOT NULL;
