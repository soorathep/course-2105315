"""Before-class and after-class notes for 2105315, Sessions 1 to 14.

Every number here comes from the slides and labs of the same session. Edit the text here,
then run build_notes.py. Inline markup: `code`, **bold**.
"""

LABS = {
    1: ('Lab 01', 'Is this file ready for the morning report?', 'audit'),
    2: ('Lab 02', 'Which gap-filling method biases the answer least?', 'gaps'),
    3: ('Lab 03', 'Spike or real process event?', 'spikes'),
    4: ('Lab 04', 'Does this figure tell the truth about the process?', 'figures'),
    5: ('Lab 05', 'Correlated, or driven by a third variable?', 'relations'),
    6: ('Lab 06', 'Did the change really shift the process?', 'shift'),
    7: ('Lab 07', 'From raw file to a defended decision', 'decision'),
}

SESSIONS = [
dict(n=1, week=1, title='Data you can trust', sub='Reading a plant data file',
  question='Before anyone computes a mean, what must you know about the file?',
  terms=[
    ('Plant data file', 'Rows of timestamp, tag (which instrument), value, unit and quality flag. An error can enter at each step from the sensor to your file.'),
    ('Sampling interval', 'How often a value is recorded: every second, every minute, hourly averages, or once per shift for a lab assay.'),
    ('Missing-value code', 'How a file marks a reading that failed: an empty cell, a number such as −200 or 9999, a text message, or a zero.'),
    ('Separator and decimal mark', 'The character between columns (`,` or `;`) and between whole and decimal parts (`.` or `,`).'),
  ],
  before=[
    'Open the course home and find Lab 01. You will load your own 14 days of data from your student ID.',
    'Read the course notebook guide once. You will not write code from memory in this course; an AI assistant writes it and you check it.',
  ],
  think='A colleague\'s code runs without an error and prints a mean CO concentration of −57 mg/m³. What must have gone wrong?',
  ideas=[
    'Your three duties when AI writes the code: ask the right question (a number, a unit, a time window), choose how to treat missing values, repeats and outliers, and verify the result.',
    'Find how the file marks a missing value **before** you compute anything. Read the documentation, then confirm it in the data. In today\'s file it is −200.',
    'Four settings read the raw file correctly: separator `;`, decimal mark `,`, missing value `-200`, date as day/month/year. Get one wrong and the result is quietly wrong.',
    'The six-check audit before any mean, plot or model: shape, types, missing, ranges and units, repeats, time steps.',
    'Four ways to check code you did not write: count rows before and after each step, check the range, compute one value by hand, plot before and after.',
  ],
  code=[
    ('df = pd.read_csv(f, sep=";", decimal=",", na_values=[-200])', 'declare all four settings when reading'),
    ('df.shape, df.dtypes', 'shape and types: numbers should be float, not object'),
    ('df.isna().sum()', 'how many missing values in each column'),
    ('df.describe()', 'minimum and maximum: is anything physically impossible?'),
    ('df.duplicated().sum()', 'rows recorded twice'),
  ],
  mistakes=[
    'Averaging −200 as if it were a concentration. In the Lab 01 Demo A file this turns a mean of 2.74 mg/m³ into about −57.0.',
    'Trusting a number because the code ran without an error.',
  ],
  check=[
    ('99 of 336 CO hours are −200 and the valid hours average 2.74 mg/m³. What does a mean that keeps −200 print?',
     '(237 × 2.74 + 99 × (−200)) / 336 ≈ −57.0 mg/m³. The range check (a negative concentration) catches it at once.'),
    ('Why is the date format one of the four settings?',
     'Read as month/day, 11/03/2004 becomes 3 November instead of 11 March, and the time order is wrong without any error.'),
    ('Both missing CO rows in the first lines of the source file are at 04:00. Why does that matter?',
     'Missing values can follow a pattern. If they do, the remaining hours are not a fair sample of the day.'),
  ],
  after=[
    'Download your file in Lab 01, Step 2. Ask an AI assistant for code that reports the three numbers in Step 5, read it, and run it in the course notebook.',
    'Do not run the audit yet. You enter your numbers first in Session 2.',
  ]),

dict(n=2, week=1, title="Audit and the AI's code", sub='Checking code you did not write',
  question='The code runs and prints a number. How do you decide whether to report it?',
  terms=[
    ('NaN', '"Not a number": how pandas stores a missing value once you declare the code (`na_values=[-200]`). Means skip NaN.'),
    ('`dropna()`', 'Removes every row that has a missing value in any column, unless you name the column.'),
    ('Reportable day', 'A day with enough valid hours for its mean to be reported. This lab uses at least 18 of 24 hours; that is an assumption, not a regulation.'),
  ],
  before=[
    'Bring the three numbers your AI-written code reported for Lab 01, Step 5. Do not run the audit before class.',
    'If your count of missing hours is 0, find the line of code that made it 0.',
  ],
  think='Three versions of the code print nan, 1.93 and 2.74 for the same file. Which one would you put in the 09:00 report, and how would you catch the other two?',
  ideas=[
    'Every line of code makes an assumption about your file. For each line, ask what it assumes and how you would check it.',
    'Code A prints nan: one column (NMHC) is missing in every hour, so `dropna()` on all columns removes every row.',
    'Code B prints 1.93: replacing −200 with 0 counts every missing hour as clean air. It is the more dangerous mistake because the number looks plausible.',
    'Code C reports 99 missing hours and a mean of 2.74. Use it, and say how many hours the mean rests on.',
    'Missing values are not spread at random. Over the whole year CO is missing at 04:00 on more than half of the days, and on about one day in six at other hours.',
    'The Session 1 and 2 file covers 15 calendar days, but CO was measured on about ten. Decide a minimum number of valid hours before you report a daily mean, and state it.',
  ],
  code=[
    ('df = df.dropna(how="all").drop_duplicates()', 'remove empty rows and repeated rows first'),
    ('df["CO(GT)"].isna().sum(), df["CO(GT)"].mean()', 'count the missing hours, then the mean of the valid hours'),
  ],
  mistakes=[
    'Using `dropna()` without naming the column you need.',
    'Filling a missing measurement with 0.',
    'Reporting the mean of the hours that are left as if it were the mean of the two weeks.',
  ],
  check=[
    ('Your code reports 0 missing hours on a file where the raw text shows −200. What happened?',
     'The missing-value code was not declared, so −200 was read as a value.'),
    ('Why is B (1.93) more dangerous than A (nan)?',
     'nan is obviously wrong. 1.93 looks like a believable concentration, so it can reach a report unnoticed.'),
    ('A day has 12 valid CO hours, all in the afternoon. Should its daily mean be reported?',
     'Not under the 18-hour rule of this lab, and the afternoon hours are not a fair sample of the day.'),
  ],
  after=[
    'Finish Lab 01 (Steps 7 to 9) and upload the study file on myCourseVille.',
    'Bring one example of a reading that goes missing in a plant, a lab or daily life, and why.',
  ]),

dict(n=3, week=2, title='Why values go missing', sub='The reason decides the fix',
  question='Before you choose how to fill a gap, what must you know about why it is there?',
  terms=[
    ('Missing for an unrelated reason', 'The gap has nothing to do with the process or the value. You have fewer data, but no bias.'),
    ('Missing for a reason you can see', 'The gap follows something recorded, for example a calibration every night at 04:00. Compare like with like.'),
    ('Missing because of the value', 'The value itself caused the gap, for example an analyzer that goes over range when the concentration is high. No fill method removes this bias.'),
    ('Gap and missing hours', 'One gap can be a single hour or several days. Count both the gaps and the hours they hold.'),
  ],
  before=[
    'Bring your example of a missing reading and be ready to say why it went missing.',
  ],
  think='For your example: would the missing value have been higher or lower than the rest? That decides whether any fill method can be trusted.',
  ideas=[
    'The reason a value is missing matters more than how many are missing.',
    'The data can point to the reason: look at missing values by time of day, by gap length, against another tag, and at the edges of each gap. They cannot prove that the value caused the gap, because that value is the one you do not have.',
    'Gaps caused by the value, such as a gauge over range or skipped samples, cannot be fixed by any method applied to the data alone. Report them, or measure another way.',
    'In the real CO record, 145 of 187 gaps are single hours, but they hold only 9 % of the missing hours. The 12 gaps longer than two days hold 68 %. A plan for single hours does not cover the outages.',
  ],
  code=[
    ('s.isna().groupby(s.index.hour).mean()', 'share of missing values at each hour of the day'),
  ],
  mistakes=[
    'Choosing a fill method before asking why the values are missing.',
    'Counting gaps only, so that a three-day outage weighs the same as one missing hour.',
  ],
  check=[
    ('A pH probe is cleaned every morning at 06:00 and reads nothing for an hour. Which kind of gap is this?',
     'Missing for a reason you can see: it follows a recorded schedule.'),
    ('A flow meter saturates at its upper limit and logs nothing above it. Can interpolation fix the mean?',
     'No. The missing values are the high ones, so any fill from the remaining data is biased low. Report it or measure another way.'),
    ('Most gaps in a record are single hours. Does that mean the gaps are a small problem?',
     'Not necessarily. In the CO record the few long outages hold 68 % of the missing hours.'),
  ],
  after=[
    'In Lab 02, do Steps 1 to 3: read what each fill method puts into a missing hour, predict, and save your study.',
    'Download your file in Lab 02, Step 5, ask an AI assistant for code for the three numbers there, and read it before you run it.',
  ]),

dict(n=4, week=2, title='Filling gaps you can defend', sub='Fill, flag, report',
  question='Which fill method can you defend for this gap, and what must the report say?',
  terms=[
    ('Drop', 'Leave the missing hours out. Assumes they are like the others.'),
    ('Fill with the mean', 'Put the overall mean in every gap. Assumes nothing changes over time.'),
    ('Linear interpolation', 'A straight line between the readings on both sides. Assumes a steady change.'),
    ('Carry the last value forward', 'Repeat the last reading. Assumes nothing changed.'),
    ('Same hour on other days', 'The mean of that clock hour on other days. Assumes a usual day.'),
  ],
  before=[
    'Bring your Lab 02 homework numbers. Compare your mean after dropping the missing hours with your mean after linear interpolation.',
  ],
  think='Which of your two means is larger, and which gap in your file explains the difference?',
  ideas=[
    'Every fill method is an assumption about the hours you did not measure. Choose the one whose assumption you can defend for this gap.',
    'A straight line is close to the truth across one or two hours. Across an evening rush and a night it misses by more than 15 µg/m³ of benzene.',
    'The AI code in Lab 02 reports "0 missing" because it invented about 90 hours, including three nights and three rush hours of the outage.',
    'A rule you can defend: fill only gaps that are short compared with how fast the value changes; flag every filled value in its own column; report how many hours were measured, filled and still missing.',
    'A filled value is an estimate, not a measurement.',
  ],
  code=[
    ('gap = s.isna().groupby(s.notna().cumsum()).transform("sum")', 'length of the gap each hour belongs to'),
    ('filled = s.fillna(s.interpolate(limit_area="inside").where(gap <= 3))', 'fill gaps of up to 3 hours only'),
    ('flag = s.isna() & filled.notna()', 'flag every filled hour'),
    ('print(s.notna().sum(), flag.sum(), filled.isna().sum())', 'measured, filled, still missing'),
  ],
  mistakes=[
    'Interpolating across a multi-day outage and reporting "no missing data".',
    'Mixing filled and measured values without a flag.',
  ],
  check=[
    ('Why does filling with the mean leave the two-week mean unchanged but still mislead?',
     'It repeats the answer you already had and adds a flat run with no daily cycle, so peaks and variability are understated.'),
    ('Which method keeps the daily pattern across a long gap, and what can it not know?',
     'Same hour on other days. It cannot know whether that particular day was busier or quieter than usual.'),
    ('What three counts belong next to a result computed on filled data?',
     'Hours measured, hours filled, and hours still missing.'),
  ],
  after=[
    'Finish Lab 02 (Steps 4 to 9) and upload the study file on myCourseVille.',
    'In your benzene chart, find the highest peak, decide whether you believe it, and write one reason.',
  ]),

dict(n=5, week=3, title='Spike or real event?', sub='Unusual is not the same as wrong',
  question='When is a sharp value an error, and when is it the most important hour in the file?',
  terms=[
    ('Standard deviation σ', 'The typical distance of values from their mean. One bad value can inflate it.'),
    ('Median and MAD', 'The median is the middle value. The MAD is the median of the distances from the median. 1.4826 × MAD (the scaled MAD) equals σ for normally distributed data.'),
    ('z-score', 'Distance from the mean of the whole record, in σ. The 3σ rule flags |z| > 3.'),
    ('Hampel filter', 'Distance from the median of the 7 nearby hours, in scaled MADs. Flags more than 3.'),
  ],
  before=[
    'Bring the highest peak from your Lab 02 chart and your reason for believing it or not.',
    'If σ is rusty, read Step 1 of the statistics refresher on the course site.',
  ],
  think='What evidence would convince you that a peak is real, and what would convince you that it is a fault?',
  ideas=[
    'Seven hours of benzene with one fault at 21.0: mean 6.66, σ 6.33, so the fault is only 2.3σ from the mean and the 3σ rule misses it. Median 4.3, scaled MAD 0.30, so it is about 56 scaled MADs away and is flagged.',
    'Three ways to call a value unusual: far from the whole record (z-score), far from its neighbors (Hampel), not seen by a second measurement (physical check). Only the third asks whether something really happened.',
    'A z-score fails on data with a daily cycle. A busy morning is far from the two-week mean; a drop to zero at noon is not. In the demo it flags two faults and two real rush hours and misses six of the eight faults.',
  ],
  code=[
    ('z = (s - s.mean()) / s.std()', 'z-score against the whole record'),
    ('med = s.rolling(7, center=True).median()', 'median of the nearby hours'),
    ('mad = s.rolling(7, center=True).apply(lambda w: np.median(np.abs(w - np.median(w))))', 'MAD of the nearby hours'),
    ('suspect = (s - med).abs() > 3 * 1.4826 * mad', 'Hampel flag'),
  ],
  mistakes=[
    'Treating "unusual" as "wrong". A real event can be unusual; a fault can look ordinary.',
    'Using a rule that measures spread with σ when the faults themselves inflate σ.',
  ],
  check=[
    ('Why does one bad value hide from the 3σ rule but not from the Hampel rule?',
     'It inflates σ, which makes its own z small. The median and the MAD barely move.'),
    ('A reading drops to 0.1 at noon, inside the range of the whole record. Which rule can catch it?',
     'Hampel, because it compares the hour with its neighbors; or a second sensor.'),
    ('When would the second-sensor check fail?',
     'When both instruments fail together, for example a shared power cut or sampling line, or when the second sensor drifts too.'),
  ],
  after=[
    'In Lab 03, do Steps 1 to 3: judge the fifteen numbered hours before you run any rule.',
    'Download your file in Lab 03, Step 5, ask an AI assistant for code for the three numbers there, and read it before you run it.',
  ]),

dict(n=6, week=3, title='Smoothing without lying', sub='A calmer chart that still tells the truth',
  question='What does a rolling mean do to peaks and timing, and when is that acceptable?',
  terms=[
    ('Rolling mean', 'The mean of a moving window of hours.'),
    ('Trailing window', 'Uses the current hour and the hours before it. Runs late by about half its window.'),
    ('Centered window', 'Uses hours on both sides. Little delay, but peaks are still lowered.'),
  ],
  before=[
    'Bring your Lab 03 homework numbers: how many hours the AI code removed and how much the mean changed.',
  ],
  think='The mean barely moved after the AI removed "outliers". Which hours did it remove: faults, real rush hours, or both?',
  ideas=[
    'A mean of several hours is never higher than the highest of them, so smoothing lowers peaks. In the demo a 6-hour mean lowers the typical daily peak by a quarter, a 24-hour mean by almost half.',
    'A trailing mean runs late by about half its window. A centered mean removes most of the delay.',
    'The AI\'s outlier code deletes real rush hours, keeps faults inside the normal range, and leaves gaps in the series. Instead, flag hours far from their neighbors, check each against the second sensor, and remove only proven faults.',
    'Four rules: say which mean the chart shows and keep the raw record visible; judge limits and event times on the raw record; trailing for a live display, centered for a report; never smooth to remove values you do not like.',
  ],
  code=[
    ('s.rolling(6).mean()', 'trailing 6-hour mean (live display)'),
    ('s.rolling(6, center=True).mean()', 'centered 6-hour mean (report)'),
  ],
  mistakes=[
    'Checking a limit or the time of a peak on a smoothed line.',
    'Showing a smoothed line without saying the window or showing the raw data.',
  ],
  check=[
    ('A 12-hour trailing mean peaks at 14:00. Roughly when did the real peak happen?',
     'About six hours earlier, around 08:00, and it was higher than the smoothed peak.'),
    ('Why can a smoothed chart show a value staying below a limit that the raw data crossed?',
     'Averaging lowers peaks, so a short exceedance disappears from the mean.'),
    ('What would you write under a weekly chart that shows a 24-hour centered mean?',
     'That it is a 24-hour centered rolling mean of hourly data, with the raw hours shown behind it, and that peaks are lower than measured.'),
  ],
  after=[
    'Finish Lab 03 (Steps 4 to 10) and upload the study file on myCourseVille.',
    'Bring one chart from a report or the news that you think misleads.',
  ]),

dict(n=7, week=4, title='Trends and distributions', sub='Choose the view that answers the question',
  question='Which view of the data answers the question being asked?',
  terms=[
    ('Time scale', 'The same record seen by week, by hour of day, by day of week, or over the year. Each answers a different question.'),
    ('Distribution', 'How the individual values spread, for example as a histogram or box plot, not only their mean.'),
    ('Median', 'The middle value. When a few high values pull the mean up, the mean is above the median.'),
  ],
  before=[
    'Bring the chart you think misleads, and be ready to say what it seems to claim and what number would check it.',
  ],
  think='A manager asks whether night-shift workers are exposed to less benzene than day-shift workers. Which view would you draw?',
  ideas=[
    'One benzene record at four scales: a week shows two peaks on each working day; the hour of day shows them near 08:00 and in the evening; the day of week shows Sunday at about half a weekday; the year shows a low August and a high October.',
    'Each view answers a different question, and none answers all of them. Choose the view before you draw.',
    'A mean hides the overlap. October\'s mean is 30 % above April\'s, yet 47 % of October\'s hours were below April\'s mean.',
    'In both months the mean is above the median, because a few rush hours pull it up.',
  ],
  code=[
    ('s.groupby(s.index.hour).mean()', 'mean by hour of day'),
    ('s.groupby(s.index.dayofweek).mean()', 'mean by day of week (0 = Monday)'),
    ('s.resample("MS").mean()', 'monthly means'),
  ],
  mistakes=[
    'Comparing two means without showing the spread of the values behind them.',
    'Answering an hour-of-day question with a chart of daily means.',
  ],
  check=[
    ('Which view shows whether weekends are cleaner?', 'The mean by day of week.'),
    ('October\'s mean is 30 % higher than April\'s. Does that mean most October hours were worse?', 'No. 47 % of October\'s hours were below April\'s mean; the distributions overlap.'),
    ('Why is the mean above the median in these months?', 'A few high rush-hour values pull the mean up; the median ignores how high they are.'),
  ],
  after=[
    'In Lab 04, do Steps 1 to 3: read the report\'s figure, make your predictions, and save your study.',
    'Download your file in Lab 04, Step 5, ask an AI assistant for code for the three numbers there, and read it before you run it.',
  ]),

dict(n=8, week=4, title='Figures that tell the truth', sub='The drawing must match the data',
  question='Every number on a chart can be correct while the chart misleads. How?',
  terms=[
    ('Baseline', 'Where the value axis starts. Bar lengths are only comparable when it starts at zero.'),
    ('Lie factor', '(seen ratio − 1) ÷ (data ratio − 1): how much bigger a change looks than it is. An honest bar chart has a lie factor of 1.'),
    ('Time window', 'The months or days a trend is fitted to.'),
  ],
  before=[
    'Bring your two monthly means from Lab 04 and work out how many times higher one is. Keep that ratio.',
  ],
  think='A slide shows 48 % and 52 % conversion with the axis starting at 46 %. How many times taller does the second bar look?',
  ideas=[
    'Starting the axis above zero makes the reader compare the leftover tips of the bars. The numbers stay correct while the picture exaggerates.',
    'A trend is only as honest as its window: from August to October benzene rises by almost 3 µg/m³ per thirty days, from October to February it falls by 1.5. Same station, same year.',
    'The code behind the report\'s figure did what it was asked. The request was the problem: ask for a figure that answers a question, not one that "shows the difference clearly".',
    'Four rules: bars start at zero; show the spread, not only the mean; say which time window you used and why; let the title state the finding with numbers.',
  ],
  code=[
    ('ax.set_ylim(bottom=0)', 'bars start at zero'),
  ],
  mistakes=[
    'A title that states a judgement ("much better") instead of the numbers.',
    'Fitting a trend to the months that support the conclusion without saying why those months.',
  ],
  check=[
    ('Bars of 48 and 52 on an axis starting at 46: what is the lie factor?',
     'Seen ratio = (52 − 46) / (48 − 46) = 3; data ratio = 52 / 48 = 1.083. Lie factor = (3 − 1) / (1.083 − 1) ≈ 24.'),
    ('Rewrite the title "Catalyst B is much better" for those bars.', 'For example: "Conversion 52 % with catalyst B and 48 % with catalyst A".'),
    ('Why should a chart of two monthly means also show the hours?', 'The means can differ while most hours overlap, as in October and April.'),
  ],
  after=[
    'Finish Lab 04 (Steps 4 to 9) and upload the study file on myCourseVille.',
    'Read Steps 1 to 3 of the statistics refresher, and think of two plant variables that rise and fall together.',
  ]),

dict(n=9, week=5, title='Correlated, or driven?', sub='When two variables move together',
  question='Two tags move together. Does one drive the other, or does a third move both?',
  terms=[
    ('Correlation coefficient r', 'How closely points follow one straight line, from −1 to +1; 0 means no straight-line pattern. In pandas: `x.corr(y)`.'),
    ('r²', 'The square of r. It is not the share of one variable that the other "explains".'),
    ('Detrending', 'Subtracting each series\' own slow trend (here a 29-day centered rolling mean) to keep the day-to-day changes.'),
    ('Third variable', 'Something that moves both, such as the season, the load or the hour.'),
  ],
  before=[
    'Read Steps 1 to 3 of the statistics refresher (σ, z, r).',
    'Bring two plant variables that rise and fall together.',
  ],
  think='For your two variables: which one would a report say drives the other, and what could move both?',
  ideas=[
    'r is not the slope, not the size of an effect, and not a direction of cause. Any variation the two series share feeds it, including a slow trend over weeks.',
    'Daily temperature against daily NOx over 16 summer weeks: r = −0.57. Both follow the calendar. After removing each series\' 29-day trend, r = 0.14. Most of the correlation came from the season.',
    'Four checks before you claim a cause: remove what both share; look at the timing (a cause comes first); name the mechanism, or write "associated with"; change it on purpose in a planned test.',
    'A small r after detrending does not prove there is no effect either.',
  ],
  code=[
    ('daily["T_degC"].corr(daily["NOx_ppb"])', 'r as reported'),
    ('trend = daily.rolling(29, center=True, min_periods=15).mean()', 'each series\' slow trend'),
    ('(daily - trend)["T_degC"].corr((daily - trend)["NOx_ppb"])', 'r after removing the trend'),
  ],
  mistakes=[
    'Reading r² = 0.32 as "temperature explains 32 % of NOx".',
    'Writing "causes" when the data only show that two series move together.',
  ],
  check=[
    ('Ice cream sales and drownings correlate. What is the third variable?', 'Hot weather, which raises both.'),
    ('r = −0.57 falls to 0.14 after detrending. What does that tell you?', 'Most of the association was the shared seasonal trend, not day-to-day co-variation.'),
    ('What sentence do the Demo A data allow?', '"Over these 16 weeks, cooler days had more NOx (r = −0.57); most of this follows the season."'),
  ],
  after=[
    'In Lab 05, do Steps 1 to 3 and save your study in Step 10.',
    'Download your file in Lab 05, Step 5, ask an AI assistant for code for the three numbers there, and read it before you run it.',
  ]),

dict(n=10, week=5, title='When did it start?', sub='Finding a slow drift',
  question='A sensor slowly drifts away from the analyzer. When did it start, and how soon can a rule tell?',
  terms=[
    ('Calibration period', 'The days used to set the reference mean and σ. Both rules assume the sensor was in control then.'),
    ('3σ rule', 'Alarms on the first day beyond mean ± 3σ. Good for a sudden step.'),
    ('CUSUM', 'A running sum of each day\'s excess over the mean minus an allowance k. It never goes below zero and alarms when it passes a limit h.'),
    ('k and h', 'The allowance (here k = 0.5σ) and the decision limit (here h = 5σ).'),
  ],
  before=[
    'Bring your Lab 05 homework numbers, including both correlations.',
  ],
  think='A drift of about 1σ rarely produces one day beyond 3σ. How could a rule notice it sooner?',
  ideas=[
    'An AI sentence such as "temperature explains NOx" claims a direction the code never tested. A sentence the data allow states the period, both correlations and says "associated with". Plot both series over time first.',
    'In Lab 05 Demo A the sensor drifts from about 19 April. The 3σ rule alarms on day 41 (10 May), three weeks late. CUSUM alarms on day 23 (22 April); the last day its sum was zero, day 19, puts the estimated start at day 20.',
    'CUSUM step: sum = max(0, previous sum + difference − mean − k). With mean 0.02, σ = 1.7486 µg/m³, k = 0.87 and h = 8.74, the sum passes h on day 23.',
    'A smaller k or h alarms sooner, and also more often on noise. If the sensor had already drifted during calibration, neither rule can see it.',
  ],
  code=[
    ('su = max(0, su + d - mu - k)', 'one CUSUM step for differences above the mean'),
  ],
  mistakes=[
    'Waiting for a single extreme day when the change is a slow drift.',
    'Calibrating on a period that already contained the drift.',
  ],
  check=[
    ('Previous sum 0.69, today\'s difference 4.17, mean 0.02, k = 0.87. New sum?', '0.69 + 4.17 − 0.02 − 0.87 = 3.97.'),
    ('σ = 1.7486. What are k = 0.5σ, h = 5σ and the 3σ limit?', 'k = 0.87, h = 8.74, 3σ = 5.25.'),
    ('Why does CUSUM find a slow drift earlier than the 3σ rule?', 'It adds up small deviations that keep the same sign, so a persistent shift crosses h within a few days.'),
  ],
  after=[
    'Finish Lab 05 (Steps 4 to 10) and upload the study file on myCourseVille.',
    'Read Steps 4 to 7 of the statistics refresher (standard error, Welch\'s t-test, p, confidence interval), and think of one change at a plant and the data that would show it worked.',
  ]),

dict(n=11, week=6, title='Did the change work?', sub='Before and after, and what p means',
  question='After a change, the mean is lower. How sure can you be that the change caused it?',
  terms=[
    ('Welch\'s t-test', 'Compares two means without assuming equal spread. Lab 06 computes p with it.'),
    ('p', 'If nothing had changed, the share of comparisons that would show a difference at least this large.'),
    ('95 % confidence interval', 'The range of changes the data allow. If it includes 0, "no change" fits the data.'),
    ('Independent values', 'Values that do not carry information about each other. The t-test assumes them.'),
  ],
  before=[
    'Read Steps 4 to 7 of the statistics refresher.',
    'Bring one plant change and the data that would show it worked, and list what else changed at the same time.',
  ],
  think='Besides your change, what else changed during the same weeks: the season, the feed, the load, a shutdown?',
  ideas=[
    'The shuffle demonstration: 28 daily means of benzene, 14 before and 14 after, differ by −1.69 µg/m³. Shuffling the labels "before" and "after" 1000 times gives a difference at least this large about once in eight. That share is the idea behind p.',
    'The shuffle only shows what p means. Lab 06 and your reports compute p with Welch\'s t-test: 0.13 for these daily means, close to the shuffle.',
    'p is not the probability that the change worked, and not the size of the change. p = 0.001 can belong to a difference too small to matter.',
    'Report the difference with its unit, a 95 % interval, the number of independent values, and p. Demo A: −1.69 µg/m³, interval −3.91 to +0.54, 14 + 14 days, p = 0.13.',
  ],
  code=[
    ('from scipy import stats', ''),
    ('stats.ttest_ind(after, before, equal_var=False)', 'Welch\'s t-test'),
  ],
  mistakes=[
    '"p = 0.04, so there is a 96 % chance the change worked." p is computed assuming nothing changed.',
    'Reporting p without the size of the difference and its interval.',
  ],
  check=[
    ('A result has p = 0.03 for a 0.1 % yield gain over 40 000 batches. Is it important?', 'Shown, but probably too small to matter. Report the size and decide on cost, not on p.'),
    ('The interval is −3.9 to +0.5 µg/m³. Is the change significant at 5 %?', 'No. The interval includes 0, which matches p above 0.05.'),
    ('What does the shuffle assume when it mixes the labels?', 'That the values are exchangeable: if nothing changed, any day could have carried either label.'),
  ],
  after=[
    'In Lab 06, do Steps 1 to 3 and save your study in Step 10.',
    'Download your file in Lab 06, Step 5, ask an AI assistant for code for the three numbers there, and read it before you run it.',
  ]),

dict(n=12, week=6, title='Tests on plant data', sub='When a t-test is too eager',
  question='Why are 670 hourly values not 670 independent measurements?',
  terms=[
    ('Autocorrelation', 'Neighboring values resemble each other. Neighboring hours of benzene correlate at about 0.84; neighboring days at about 0.6.'),
    ('Standard error', 'How much a mean would vary from sample to sample. It is too small when values are not independent.'),
    ('Placebo dates', 'Dates where nothing was changed. Testing them shows how often the test calls "significant" by chance.'),
  ],
  before=[
    'Bring your Lab 06 homework numbers and your p.',
  ],
  think='If the hourly test is fair, at what share of ordinary dates should it give p below 0.05?',
  ideas=[
    'The t-test on 667 hours treats them as independent. They are not, so the standard error and p are too small. For Demo A, p rises from 0.00006 (hours) to 0.13 (one value per day).',
    'At every ordinary date in the year, the hourly test calls 58 % of them significant. A fair test would call about 5 %. The daily test calls 25 %: better, still five times too many.',
    'Three reasons: hours are not independent; days are not either, because weather lasts several days; fortnights differ, because the season and holidays move the level.',
    'Demo A: a difference as large as −1.69 appears at 45 % of ordinary dates, so the data do not show an effect. Demo B: −5.93 appears at only 1 of 306 dates, a real shift, but the data cannot say whether the plan or the November weather caused it.',
    'Before a decision, ask for a comparison that rules out the other cause, such as a station the change did not touch.',
  ],
  code=[
    ('daily = df.set_index("datetime").resample("D")["C6H6_ugm3"].mean()', 'one value per day'),
  ],
  mistakes=[
    'Counting values instead of independent values.',
    'Concluding that a significant shift was caused by the change, when the season changed too.',
  ],
  check=[
    ('An engineer compares 1-minute temperatures for one day before and after a retune and gets p = 10⁻²⁰. Why does this overstate the evidence?', 'Minutes are strongly autocorrelated, and one day per side cannot separate the retune from day-to-day differences.'),
    ('What do placebo dates measure?', 'How often ordinary periods, with no change, show a difference as large as yours.'),
    ('What sentence would you write for Demo B?', 'Benzene was 5.9 µg/m³ lower after the date, a shift larger than at almost any ordinary date, but the data cannot separate the traffic plan from the weather.'),
  ],
  after=[
    'Finish Lab 06 (Steps 4 to 10) and upload the study file on myCourseVille.',
    'Look back at your Lab 01 audit: which check would you run first on a new file?',
  ]),

dict(n=13, week=7, title='Raw file to decision', sub='Every check, in order, on new files',
  question='Two raw files arrive. What do you check before you merge them?',
  terms=[
    ('Time zone and UTC', 'Local time differs from UTC by a fixed offset (UTC + 2 for the files in Lab 07).'),
    ('Merge', 'Joining two files on a shared column such as the timestamp.'),
    ('Lag scan', 'Shifting one series hour by hour and watching the correlation. The shift with the highest r shows the clock offset.'),
  ],
  before=[
    'Look back at your Lab 01 audit and decide which check you would run first on a new file.',
  ],
  think='Name the first three checks you would run on a new raw file, in order, and what each would catch.',
  ideas=[
    'Two files from one station: the sensor is stamped in local time, the analyzer in UTC. The plain merge pairs each sensor hour with the analyzer two hours later: r = 0.54 over 28 days. Shifted by +2 hours, the peaks line up and r = 0.93.',
    'A lag scan is the check that finds a wrong clock.',
    'The path from raw file to decision has five steps: audit, clean, align, analyze, decide. Each comes from a week of the course.',
    'An error in an early step does not show as an error later. It shows as a confident wrong number.',
  ],
  code=[
    ('a["datetime_local"] = a["datetime_utc"] + pd.Timedelta(hours=2)', 'put both files on the same clock'),
    ('[s.corr(b.shift(k)) for k in range(-2, 5)]', 'a lag scan'),
  ],
  mistakes=[
    'Merging on timestamps without checking that both files use the same clock.',
    'Merging before removing repeated rows, which copies them.',
  ],
  check=[
    ('A sensor file is in UTC + 2 and the analyzer in UTC. Merged as they are, which analyzer hour is each sensor hour paired with?', 'The analyzer value from 2 hours later.'),
    ('A purity assay is taken twice a day and temperature every 10 seconds. How do you join them?', 'For each sample, take the temperature at its sampling time (merge_asof) or its mean over the hours before it, after checking both clocks.'),
    ('Which week of the course does each step of the path come from?', 'Audit: weeks 1 to 2; clean: weeks 2 to 3; align: week 7; analyze: weeks 4 to 6; decide: week 7.'),
  ],
  after=[
    'In Lab 07, do Steps 1 to 3 and save your study in Step 10.',
    'Download both files in Lab 07, Step 5, ask an AI assistant for code for the three numbers there, and read it before you run it.',
  ]),

dict(n=14, week=7, title='Defend your decision', sub='Align, calibrate, test, decide',
  question='Can a manager act on your decision, and can a reviewer repeat it?',
  terms=[
    ('Calibration fit', 'A straight line from the sensor reading to benzene, fitted on the calibration week.'),
    ('Alert rule', 'Here: the sensor must flag at least 80 % of the hours above 15 µg/m³.'),
    ('Decision memo', 'Decision, evidence with numbers, what was done to the raw files, and the limits of the test.'),
  ],
  before=[
    'Bring your Lab 07 homework numbers, including the slope.',
  ],
  think='A reviewer gets 62 % from the same two files where you got 91 %. Which two steps would you ask them to check first?',
  ideas=[
    'The AI merge renamed both time columns to `t`, which hides that one is in UTC, and copied three repeated sensor rows. Neither raises an error; both change the number the decision rests on.',
    'With the plain merge the calibration line is flat (r = 0.51). With aligned files r = 0.92 and the slope doubles. The flat line predicts a rush-hour peak at about two thirds of its height, so the alert flags 51 % of the hours above 15 µg/m³ instead of 91 %.',
    'A decision memo: the decision in one sentence; the evidence with numbers and their basis; what you did to the raw files; the limits of the test. A reviewer with your files and memo should get the same numbers.',
    'The order of the course: audit, clean, align, analyze, decide.',
  ],
  code=[
    ('sensor = sensor.drop_duplicates()', 'before any merge'),
    ('np.polyfit(x, y, 1)', 'slope and intercept of the calibration line'),
  ],
  mistakes=[
    'A memo that states the decision but not what was done to the raw files.',
    'Calibrating on misaligned data, which flattens the slope and underestimates peaks.',
  ],
  check=[
    ('Why does a 2-hour clock error flatten the calibration slope?', 'High sensor readings at rush hour are paired with benzene that has already fallen, so the cloud of points is flatter and more scattered.'),
    ('Your memo says 91 %; a reviewer gets 62 %. Which two steps first?', 'Removing the repeated rows and aligning the clocks of the two files.'),
    ('What makes a decision defensible?', 'Another person with the same files and your memo gets the same numbers.'),
  ],
  after=[
    'Finish Lab 07 (Steps 4 to 10) and upload the study file on myCourseVille.',
    'Answer the exit ticket and the course feedback for Sessions 1 to 14.',
  ]),
]
