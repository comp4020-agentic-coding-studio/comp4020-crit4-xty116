# Crit 4 reflection

## What was the breakthrough that moved the work forward?

The breakthrough was realising that "no wrong note" did not have to mean removing choice. I could constrain pitch to a carefully chosen fifteen-note scale while leaving timbre, intensity, stereo position, rhythm and gesture open. That made the interaction immediately generous: a first click already sounds intentional, but a drag, a keyboard phrase and a change from Glass to Ember still produce recognisably different performances. Separating the musical model from the audio and canvas code also made that idea testable. I could prove that every horizontal position stayed inside the same scale and that vertical movement changed brightness without accidentally changing pitch.

## What did this work change about who I want to be as a software developer?

It made me want to be a developer who treats felt quality as seriously as functional correctness. The agent could create oscillators, envelopes and responsive CSS, but it could not decide whether the instrument invited play or whether the sound became tiring. Tests were useful for keeping the contract honest; my own listening and repeated performance were the harness for latency, balance and character. I also learned not to confuse an unavailable API in one preview environment with a broken design. Diagnosing that boundary, preserving live synthesis and adding a graceful visual response was more valuable than blindly retrying. I want future systems I build to combine those two kinds of care: explicit mechanical constraints and deliberate human judgement.
