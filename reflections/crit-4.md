# Crit 4 reflection

## What was the breakthrough that moved the work forward?

The breakthrough was recognising that a collection of attractive loops was still not a complete musical experience. The feedback asked for varied timbres and examples that felt like whole pieces. I translated that into structure: eight named bars per composition, deliberate introductions, development, fuller sections, returns and endings. The song map makes that form visible, while every bar remains editable. I also stopped treating “voice” as one oscillator with three labels. The six lanes now have different synthesis behaviours, including pitched percussion, generated noise, filtered bass, chords, plucks and harmonic bells. That change made the interface and sound design support the same idea: composing by combining distinct parts.

## What did this work change about who I want to be as a software developer?

It strengthened my willingness to revise work at the level where the problem actually lives. This prototype went through two discarded directions. Keeping the existing code and adding visual polish would have been easier, but it would not have answered the criticism. Writing the full-song and multi-timbre expectations into the harness before rebuilding gave the revision discipline. It also reminded me that experiential software needs more than static correctness. Unit tests proved the data shape and synthesis contracts; timed browser testing proved that the transport crossed bar boundaries, mobile inspection caught layout pressure, and an actual edit verified the player could take ownership of the piece. I want to keep combining those forms of evidence instead of trusting only the easiest one to automate.
