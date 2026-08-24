# Crit 4 reflection

## What was the breakthrough that moved the work forward?

The breakthrough was treating automatic performance as editable musical material instead of a demonstration the user watches. Each example in Loop Press is only a small matrix of note decisions. Loading one makes the structure visible, and any cell can immediately be removed, added or performed over. The same synthesis function plays grid edits, keyboard improvisation and sequenced notes. That kept the automatic feature inside the brief: the browser is still generating sound live, and the player's decisions about pattern, tempo, swing and tone continue to shape what happens. It also gave the interface a clearer point of view than the discarded star-map version. The printing metaphor belongs to the action of making and revising a loop, not just its decoration.

## What did this work change about who I want to be as a software developer?

It reinforced that I want to be willing to discard polished work when the central idea is not convincing. Recolouring the first version would have been faster, but it would not have answered the feedback. Moving the correction into the harness before rebuilding made the new direction concrete and testable. I also saw how experiential testing exposes boundaries that static checks cannot: every unit test passed while the automatic playhead remained frozen on a suspended audio clock. Diagnosing that state, separating clocks and then protecting the fix with a regression test is the kind of workflow I want to keep. Good development is not choosing between human judgement and automation; it is knowing which one should notice the problem and then teaching the other to keep it fixed.
