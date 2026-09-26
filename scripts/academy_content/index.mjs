import { p1, p2, p3 } from './programs_1_3.mjs';
import { p4, p5 } from './programs_4_5.mjs';
import { p6, p7 } from './programs_6_7.mjs';
import { p8, p9, p10 } from './programs_8_10.mjs';
import { toolkit } from './toolkit.mjs';

// The authored questions were written with the correct choice in a natural position; a quiz whose answer is nearly always "B" is
// guessable. Swap the correct choice into a balanced, deterministic target position (no randomness → reproducible builds and tests).
const TARGETS = [2, 0, 3, 1, 1, 3, 0, 2, 3, 2, 0, 1];
function balance(program) {
  const questions = program.questions.map((q, i) => {
    const target = TARGETS[(i + program.slug.length) % TARGETS.length];
    const choices = [...q.choices]; const correct = choices[q.answer];
    [choices[q.answer], choices[target]] = [choices[target], choices[q.answer]];
    return { ...q, choices, answer: choices.indexOf(correct) };
  });
  return { ...program, questions };
}
export const programs = [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10].map(balance);
export { toolkit };
