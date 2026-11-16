# 2105315 Data Analytics labs

Interactive labs for 2105315 Data Analytics in Chemical Engineering (weeks 1 to 7, before the midterm).
Source here; `build.py` publishes to `teaching/2105315/labs/` (and refreshes the shared kit first).

From 2026/2 students do not write code from scratch. They learn the principle in the lab, let an AI
assistant write notebook code, and check that code. Each lab therefore has:

- a short incident and one question;
- a prediction before the reveal (Lab 01: eight statements about the file; Lab 02: a method for each kind of gap);
- "Check the AI's code": plausible code with one realistic error, answered in writing before the explanation opens;
- notebook numbers: the student runs AI-written code on their own data file and enters the results; the lab,
  which computes the same quantities independently in JavaScript, is the reference;
- a data set chosen from the student ID, so numbers differ between students;
- one JSON study file for submission on myCourseVille (questions, answers, choices, results).

## Lab 01 · Is this file ready for the morning report?

Data: UCI Air Quality (De Vito, doi:10.24432/C59K5F, CC BY 4.0), hourly, March 2004 to April 2005.
`tools/make_airquality.py` builds `assets/data/airquality.json` from the UCI file and checks its sha256.
Each student gets a 14-day window starting at any hour (about 9,000 choices) with three repeated rows
inserted. The repeats are the only change to the data; the page says so.

Checks before each push:

    python3 _teaching-src/2105315/labs/build.py
    python3 _teaching-src/2105315/labs/tests/smoke_test.py         # Playwright, desktop and 375 px
    python3 _teaching-src/2105315/labs/tests/engine_vs_pandas.py   # needs Node.js; engine = pandas

## Lab 02 · Which gap-filling method biases the answer least?

Data: benzene, C6H6(GT), from the same UCI file. Each window is a real 14-day stretch with no missing
benzene hour (4,340 choices), so every hour has a true value. Gaps are removed on purpose, from a seed
derived from the student ID: 12 scattered single hours, every 04:00, one 72-hour outage, and (Extension) the
15 highest hours. Five methods (drop, mean, linear interpolation, forward fill, same hour on other days) are
compared on the two-week mean and the typical daily peak (mean of daily maxima). Engine: `assets/gaps-engine.js`.

    python3 _teaching-src/2105315/labs/tests/gaps_vs_pandas.py     # needs Node.js; engine = pandas

The study file records `dataset.startIndex` and the predictions with the methods that were closest, so a
grader can recompute everything from the student ID.

## Lab 03 · Spike or real process event?

Data: benzene C6H6(GT) and the co-located sensor PT08.S1(CO) (r = 0.88 over the year), 14-day windows with
both complete. Eight one-hour transmitter faults are put into benzene only (four jumps of 15 to 30, two of
6 to 10, two drops to 0.1), so each fault is known. Three rules are scored against them: z-score > 3 over
the window, Hampel (7-hour centered median, 3 MAD), and the residual from a straight-line fit to the sensor
(4 MAD). Step 7 smooths the true record (rolling mean, trailing or centered) and reports the typical daily
peak and the lag. Engine: `assets/spikes-engine.js`.

    python3 _teaching-src/2105315/labs/tests/spikes_vs_pandas.py   # needs Node.js; engine = pandas

## Lab 04 · Does this figure tell the truth about the process?

Data: hourly benzene, whole months April 2004 to March 2005, -200 left out, nothing else changed. The
student ID picks one of 50 month pairs whose means differ by 10 % to 100 % (pairs repeat across a large
class; the questions are about the figure, not the number). The report's bar chart starts its axis at
floor(0.9 × the smaller mean), as the AI code does; Step 6 shows the lie factor (Tufte). Step 7 compares the
two distributions; Step 9 fits a line through daily means for a chosen span of months.
Engine: `assets/figures-engine.js`.

    python3 _teaching-src/2105315/labs/tests/figures_vs_pandas.py  # needs Node.js; engine = pandas/numpy

## Lab 05 · Correlated, or driven by a third variable?

Part A: daily NOx(GT) and temperature over 16 weeks (47 windows, June to August 2004 starts, where |r| is at
least 0.4 and at least 70 days have both). The correlation is compared with the correlation after
subtracting a 29-day centered rolling mean from each series. Part B: the sensor PT08.S1(CO) is fitted to
benzene on the first 14 days of another 16-week window (278 choices); daily mean residuals are watched with a
two-sided CUSUM (k = 0.5σ, h = 5σ, σ from the calibration days) and with a 3σ rule. The drift is real, as
described in De Vito et al. (2008). Engine: `assets/relations-engine.js`.

    python3 _teaching-src/2105315/labs/tests/relations_vs_pandas.py # needs Node.js; engine = pandas

## Lab 06 · Did the change really shift the process?

A change date (97 choices: the dates where a Welch t-test on hourly benzene, 14 days before against 14 days
after, gives p < 0.01, and all four Extension windows have enough data) is tested three ways: the hourly t-test, a Welch t-test on daily means (days with
at least 18 hours, at least 12 days a side), and the same comparison at every placebo date in the record
(about 300). At those dates the hourly test calls 58 % significant and the daily test 25 %; the student's
difference is ranked among the placebo differences. Extension: windows of 7, 14, 21 and 28 days. Engine:
`assets/shift-engine.js`.

    python3 _teaching-src/2105315/labs/tests/shift_vs_pandas.py # needs Node.js and scipy; engine = scipy

## Lab 07 · From raw file to a defended decision

Two raw files from one 28-day window (about 160 choices, all in summer time, 29 March to 30 October 2004):
the sensor PT08.S1(CO) in local time with three repeated rows, and benzene C6H6(GT) stamped in UTC. Students
audit both, find the clock offset with a lag scan (+2 h), calibrate the sensor on week 1 and test an hourly
alert (benzene above 15 µg/m³, at least 80 % of such hours flagged) in weeks 2 to 4, for the aligned files and
for the plain merge. Extension: an alert margin. Engine: `assets/decision-engine.js`.

    python3 _teaching-src/2105315/labs/tests/decision_vs_pandas.py # needs Node.js; engine = pandas, from the raw files

## Grading

The study file carries the question text with each answer, so it can be read by a person or by an AI
grader. `audit` and `notebook.reference` are computed by the page; the file can be edited by a student, so
recompute from `dataset.startIndex` and `dataset.repeatedBlockAt` when a number matters. A `dataset.seedId`
that differs from `student.studentId` means the work was done on someone else's data set. Keep rubrics and
answer keys outside this public repository.
