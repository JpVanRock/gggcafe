-- =============================================================================
-- GGG.Cafe — Align a starter practice question with the Baserunning Playbook
-- Runner on second, ball hit to the shortstop: the playbook says get a good jump
-- and take third once she throws to first (not "hold unless it gets through").
-- =============================================================================
update public.iq_questions
   set choices = array[
         'Take off for third right away',
         'Get a good jump, then take third once she throws to first',
         'Go halfway and decide',
         'Stay at second no matter where she throws'],
       correct_index = 1,
       explanation = 'The ball is in front of you, so don''t run into an out at third. Get off the bag ready to go, let the shortstop commit her throw to first, then take third.'
 where track is null
   and topic = 'general'
   and scenario like 'You''re the runner on second base, nobody out.%';
