import type { ElementType } from "react";
import {
  Atom,
  Waves,
  Activity,
  Filter,
  Zap,
  Radio,
  Clock,
  MoveHorizontal,
  Scaling,
  BarChart3,
  Gauge,
  Sigma,
  Binary,
  AudioLines,
  CircleDot,
  Repeat,
  Cpu,
} from "lucide-react";

export type ConceptId =
  | "fourier-series"
  | "amplitude-phase"
  | "convolution"
  | "rect-pulse-ft"
  | "bandlimited"
  | "even-odd"
  | "fourier-transform"
  | "time-shifting"
  | "frequency-shifting"
  | "time-scaling"
  | "differentiation-integration"
  | "parseval"
  | "energy-power-spectrum"
  | "impulse-step"
  | "sampling"
  | "aliasing"
  | "frequency-response"
  | "transfer-function"
  | "modulation"
  | "correlation"
  | "discrete-time-ft"
  | "dtft"
  | "z-transform";

export interface ConceptMeta {
  id: ConceptId;
  title: string;
  subtitle: string;
  icon: ElementType;
  realLife: string;
  formula: string;
  formulaNote?: string;
  tags: string[];
  discussion: string[];
}

export const CONCEPTS: ConceptMeta[] = [
  {
    id: "fourier-series",
    title: "Fourier Series Decomposition",
    subtitle: "Any periodic signal = sum of sinusoids",
    icon: Waves,
    realLife:
      "Synthesizers, audio codecs, and power electronics all break complex waveforms into pure tones. Adding the first few harmonics of a square wave already produces the characteristic “buzz” of a square-wave oscillator used in early video games and synth leads.",
    formula: "x(t) = a₀/2 + Σₖ [aₖ cos(kω₀t) + bₖ sin(kω₀t)]",
    formulaNote: "ω₀ = 2π/T  (fundamental frequency)",
    tags: ["Fourier Series", "Harmonics", "Periodic"],
    discussion: [
      "A continuous-time signal that repeats every T seconds can be written as a sum of cosine and sine waves whose frequencies are integer multiples of the fundamental ω₀ = 2π/T. The coefficients aₖ and bₖ tell you how much of each harmonic is present.",
      "In the complex exponential form the same idea appears as a two-sided sum of e^{j k ω₀ t} terms. Negative frequencies arise mathematically from Euler’s formula; they have no separate physical meaning for real-valued signals.",
      "Truncating the series (using only the first N harmonics) produces a partial-sum approximation. For discontinuous signals such as a square wave you still see the Gibbs phenomenon—overshoot near the edges that never disappears, only becomes narrower as N grows.",
      "This decomposition is the theoretical foundation of additive synthesis, harmonic analysis of power-system waveforms, and the discrete Fourier series used inside every FFT-based algorithm.",
    ],
  },
  {
    id: "amplitude-phase",
    title: "Amplitude & Phase Spectra",
    subtitle: "How much of each frequency + when it arrives",
    icon: Activity,
    realLife:
      "An audio equalizer is literally an amplitude-spectrum editor. Phase spectrum controls timing (group delay); in communications, phase encodes information in PSK modulations. MRI machines reconstruct images from measured magnitude and phase of spatial-frequency components.",
    formula: "X(ω) = |X(ω)| e^{j arg(X(ω))}",
    formulaNote: "|X| = √(R²+I²),  arg = arctan(I/R)",
    tags: ["Spectrum", "Polar form", "Real signals"],
    discussion: [
      "Any Fourier transform X(ω) is a complex number at each frequency. Writing it in polar form separates the information into two real-valued functions: the amplitude (or magnitude) spectrum |X(ω)| and the phase spectrum arg(X(ω)).",
      "The amplitude spectrum shows how much energy exists at each frequency; the phase spectrum shows the relative time shift of that frequency component. Changing only the amplitudes alters the “tone colour”; changing only the phases alters the waveform shape while keeping the same frequency content.",
      "For real-valued signals the Fourier transform is Hermitian: X(−ω) = X*(ω). Consequently the magnitude is even and the phase is odd. That is why we usually plot only the positive-frequency half of the spectra.",
      "In practice we obtain these spectra from the rectangular form R(ω) + j I(ω) by the usual conversion |X| = √(R² + I²) and arg = atan2(I, R).",
    ],
  },
  {
    id: "convolution",
    title: "Convolution & LTI Systems",
    subtitle: "Output = input ★ impulse response",
    icon: Zap,
    realLife:
      "Every linear filter (audio EQ, camera blur, wireless channel, RC circuit) is convolution in the time domain. Knowing h(t) lets you predict the output for any input—exactly what circuit simulators and digital audio plugins do millions of times per second.",
    formula: "y[n] = x[n] * h[n] = Σₖ x[k] h[n−k]",
    formulaNote: "Continuous: y(t) = ∫ x(τ) h(t−τ) dτ",
    tags: ["LTI", "Impulse response", "Filtering"],
    discussion: [
      "Any discrete-time signal can be written as a weighted sum of delayed unit impulses: x[n] = Σ x[k] δ[n−k]. Because an LTI system is completely characterized by its impulse response h[n], the response to each weighted impulse is simply the same weight times a shifted copy of h.",
      "Superposition then yields the convolution sum y[n] = Σ x[k] h[n−k]. The continuous-time counterpart is the convolution integral.",
      "Computationally one visualizes the process as “flip h, slide it across x, multiply point-wise, and add.” The same operation appears as multiplication in the frequency domain (the convolution theorem).",
      "Once you know h[n] (or h(t)) you can predict the output for every possible input. That single fact is the reason LTI theory dominates circuit analysis, DSP, and communications.",
    ],
  },
  {
    id: "rect-pulse-ft",
    title: "Rect Pulse → Sinc Spectrum",
    subtitle: "Time-limited ↔ infinite bandwidth",
    icon: Filter,
    realLife:
      "A digital data pulse (NRZ bit) has a sinc-shaped spectrum. The first nulls determine the minimum bandwidth needed to transmit without ISI. This is why pulse-shaping filters (raised-cosine) appear in every Wi-Fi and cellular modem.",
    formula: "X(ω) = τ · sinc(ωτ / 2π)",
    formulaNote: "Wider pulse → narrower main lobe (duality)",
    tags: ["Fourier Transform", "Sinc", "Duality"],
    discussion: [
      "The rectangular pulse of duration τ and height 1 is an even signal, so its Fourier transform reduces to a pure cosine integral, yielding the classic sinc: X(ω) = τ sinc(ωτ / 2π).",
      "The main lobe width is proportional to 1/τ. A short pulse spreads energy over a wide band; a long pulse concentrates energy near DC. This is the fundamental time–frequency duality.",
      "Because a perfect rectangle is discontinuous, its spectrum decays only as 1/ω and never becomes exactly zero.",
      "The same mathematics appears when you window a signal with a rectangular window before an FFT: the true spectrum is convolved with a sinc (spectral leakage).",
    ],
  },
  {
    id: "bandlimited",
    title: "Bandlimited Signals",
    subtitle: "No energy above B Hz → infinite duration",
    icon: Radio,
    realLife:
      "Speech is roughly bandlimited to 4 kHz; music to 20 kHz. The sampling theorem (Nyquist) says you need > 2B samples/s. All digital audio, video codecs and radio receivers rely on this.",
    formula: "X(ω) = 0  for |ω| > B",
    formulaNote: "Time-limited signals always have infinite bandwidth",
    tags: ["Bandwidth", "Sampling", "Nyquist"],
    discussion: [
      "A signal is bandlimited with bandwidth B when its Fourier transform is identically zero outside [−B, B]. Such signals are completely determined by samples taken faster than 2B (Nyquist rate).",
      "A non-zero bandlimited signal cannot be time-limited. If it were zero outside a finite interval its spectrum could not vanish on an open set of frequencies unless it were identically zero.",
      "Every finite-duration recording has infinite theoretical bandwidth; in practice we treat it as essentially bandlimited and apply an anti-aliasing filter before sampling.",
      "These ideas underwrite every digital audio chain and software-defined radio.",
    ],
  },
  {
    id: "even-odd",
    title: "Even / Odd Symmetry",
    subtitle: "Even → real cosine transform, Odd → imaginary sine",
    icon: Atom,
    realLife:
      "Many physical systems produce even impulse responses (symmetric filters). Real-valued even signals have purely real spectra—useful for simplifying FFT algorithms and for the discrete cosine transform in JPEG/MPEG.",
    formula:
      "Even: X(ω) = 2 ∫₀^∞ x(t) cos(ωt) dt\nOdd:  X(ω) = −j 2 ∫₀^∞ x(t) sin(ωt) dt",
    tags: ["Symmetry", "Hermitian", "Real FT"],
    discussion: [
      "An even signal satisfies x(−t) = x(t); an odd signal satisfies x(−t) = −x(t). Cosine is even and sine is odd, so the Fourier integral simplifies.",
      "For a real even signal the imaginary part of the transform vanishes (pure cosine transform). For a real odd signal the real part vanishes (pure sine transform).",
      "Any real signal splits into even + odd parts. The even part contributes Re{X(ω)}; the odd part contributes Im{X(ω)}. This is consistent with Hermitian symmetry X(−ω) = X*(ω).",
      "Linear-phase FIR filters are designed with even/odd symmetry so the phase is exactly linear; the DCT used in JPEG is the FT of an even extension of the data block.",
    ],
  },
  {
    id: "fourier-transform",
    title: "Fourier Transform",
    subtitle: "From time domain to continuous frequency spectrum",
    icon: BarChart3,
    realLife:
      "Spectrum analyzers, FFT-based EQ, radar, and MRI all compute (approximations of) the Fourier transform to reveal which frequencies are present in a measured signal.",
    formula: "X(ω) = ∫_{-∞}^{∞} x(t) e^{−jωt} dt",
    formulaNote: "Inverse: x(t) = (1/2π) ∫ X(ω) e^{jωt} dω",
    tags: ["Fourier Transform", "Spectrum", "Analysis"],
    discussion: [
      "The Fourier transform extends the Fourier series idea to aperiodic signals. Instead of discrete harmonic lines you obtain a continuous density of frequency components X(ω).",
      "X(ω) is complex in general; its magnitude and phase tell you the strength and timing of each infinitesimal frequency contribution.",
      "Many important pairs are known in closed form (rect ↔ sinc, exp(−a|t|) ↔ Lorentzian, Gaussian ↔ Gaussian). These pairs are the building blocks of signal-processing design.",
      "In discrete computation we approximate the integral by an FFT; understanding the continuous transform first prevents many sampling and windowing mistakes.",
    ],
  },
  {
    id: "time-shifting",
    title: "Time Shifting",
    subtitle: "Delay in time → linear phase in frequency",
    icon: Clock,
    realLife:
      "Echo, latency compensation in audio interfaces, radar range measurement, and multipath in wireless channels are all time shifts. The corresponding frequency-domain effect is a pure phase ramp.",
    formula: "x(t − t₀)  ↔  X(ω) e^{−jω t₀}",
    formulaNote: "Magnitude unchanged; phase = −ω t₀",
    tags: ["Properties", "Delay", "Phase"],
    discussion: [
      "Shifting a signal later in time multiplies its Fourier transform by the complex exponential e^{−jω t₀}. The magnitude spectrum stays identical; only the phase changes (a linear function of frequency).",
      "This is why pure delay is a linear-phase system: every frequency component is delayed by the same amount of time.",
      "In discrete time the same rule holds: x[n − n₀] ↔ X(e^{jω}) e^{−jω n₀}.",
      "Radar and sonar measure range precisely by estimating the time shift (and therefore the phase ramp) between transmitted and received pulses.",
    ],
  },
  {
    id: "frequency-shifting",
    title: "Frequency Shifting (Modulation)",
    subtitle: "Multiply by a carrier → spectrum slides",
    icon: Radio,
    realLife:
      "AM radio, up-conversion in transmitters, and frequency-division multiplexing all rely on multiplying a baseband signal by a high-frequency carrier, which translates its spectrum to a new center frequency.",
    formula: "x(t) cos(ω_c t)  ↔  ½ [X(ω−ω_c) + X(ω+ω_c)]",
    formulaNote: "Spectrum appears at ± carrier frequency",
    tags: ["Modulation", "Carrier", "Properties"],
    discussion: [
      "Multiplying a signal by a cosine of frequency ω_c splits its spectrum into two copies centered at +ω_c and −ω_c, each scaled by ½.",
      "This is the mathematical basis of amplitude modulation (AM) and of frequency translation (up-conversion / down-conversion) in every radio.",
      "The same property lets us move a signal into a frequency band where antennas or channels work better, then move it back at the receiver by another multiplication (demodulation).",
      "In discrete time the analogous operation is multiplication by e^{j ω₀ n}, which circularly shifts the DTFT.",
    ],
  },
  {
    id: "time-scaling",
    title: "Time Scaling",
    subtitle: "Compress time → expand frequency (and vice-versa)",
    icon: Scaling,
    realLife:
      "Playing a recording faster raises its pitch (frequency expansion). Chirp radar and wavelet transforms deliberately use time-scaled copies of a prototype pulse.",
    formula: "x(a t)  ↔  (1/|a|) X(ω/a)",
    formulaNote: "a > 1 compresses time, stretches spectrum",
    tags: ["Properties", "Duality", "Scaling"],
    discussion: [
      "If you speed a signal up (a > 1) its Fourier transform spreads out in frequency and drops in height by 1/|a|. Slowing it down does the opposite.",
      "This is another face of time–frequency duality: you cannot make a signal both short in time and narrow in frequency.",
      "Practical consequences appear in audio time-stretching algorithms (which try to change duration without changing pitch) and in the design of wideband radar waveforms.",
      "The scaling property is also the reason the uncertainty principle appears in signal processing and in quantum mechanics.",
    ],
  },
  {
    id: "differentiation-integration",
    title: "Differentiation & Integration",
    subtitle: "d/dt multiplies by jω; ∫ divides by jω",
    icon: Activity,
    realLife:
      "Velocity is the derivative of position; current through a capacitor is C dV/dt. In the frequency domain these become simple multiplications, which is why phasor analysis works for circuits.",
    formula: "dx/dt  ↔  jω X(ω)\n∫ x(τ) dτ  ↔  X(ω)/(jω) + π X(0) δ(ω)",
    tags: ["Properties", "jω", "Circuits"],
    discussion: [
      "Differentiating a signal in time multiplies its Fourier transform by jω. High frequencies are therefore amplified—exactly what a differentiator circuit does.",
      "Integration divides by jω (plus a possible DC impulse). Low frequencies are boosted; high frequencies are attenuated.",
      "These rules turn differential equations of LTI circuits into algebraic equations in the s- or jω-domain, which is the foundation of classical circuit analysis and control theory.",
      "In discrete time the analogous operators are first differences and cumulative sums, with transfer functions 1−z^{−1} and 1/(1−z^{−1}).",
    ],
  },
  {
    id: "parseval",
    title: "Parseval’s Theorem",
    subtitle: "Energy in time = energy in frequency",
    icon: Sigma,
    realLife:
      "Power meters, SNR calculations, and audio loudness algorithms all rely on the fact that total energy can be computed either from the waveform or from its spectrum—they give the same number.",
    formula: "∫ |x(t)|² dt = (1/2π) ∫ |X(ω)|² dω",
    formulaNote: "Also holds for power signals with appropriate limits",
    tags: ["Energy", "Power", "Identity"],
    discussion: [
      "Parseval’s relation states that the energy of a signal is the same whether you integrate the squared magnitude in time or in frequency (with the proper 1/2π factor).",
      "It is a direct consequence of the unitarity of the Fourier transform and of the convolution theorem applied to x(t) and x*(−t).",
      "Engineers use it constantly: compute the energy of a filter’s impulse response from its frequency response, or estimate noise power from a measured spectrum.",
      "The discrete version (Parseval for DFT) is the reason many audio and image codecs operate in a transform domain while still controlling time-domain energy.",
    ],
  },
  {
    id: "energy-power-spectrum",
    title: "Energy & Power Spectral Density",
    subtitle: "How energy/power is distributed across frequency",
    icon: BarChart3,
    realLife:
      "Spectrum analyzers display power spectral density. Noise figure, channel capacity, and the design of matched filters all start from the PSD of the signals involved.",
    formula: "Sₓₓ(ω) = |X(ω)|²  (energy signals)\nPSD via Wiener–Khinchin for power signals",
    tags: ["PSD", "Energy", "Noise"],
    discussion: [
      "For finite-energy signals the energy spectral density is simply |X(ω)|². Integrating it (with 1/2π) recovers the total energy by Parseval.",
      "For power signals (that never die out) we define the power spectral density via the Fourier transform of the autocorrelation function (Wiener–Khinchin theorem).",
      "White noise has a flat PSD; colored noise has a shaped PSD. Knowing the shape lets us design whitening filters and optimal detectors.",
      "In practice we estimate PSDs with periodograms, Welch’s method, or parametric models—always remembering the underlying continuous-time definitions.",
    ],
  },
  {
    id: "impulse-step",
    title: "Impulse & Step Responses",
    subtitle: "δ(t) and u(t) completely characterize an LTI system",
    icon: CircleDot,
    realLife:
      "An engineer measures the impulse response of a room (with a clap or a balloon pop) or of a loudspeaker; the step response of a control system shows overshoot and settling time.",
    formula: "h(t) = T{δ(t)}\ny_step(t) = ∫_{-∞}^{t} h(τ) dτ",
    tags: ["LTI", "Impulse", "Step"],
    discussion: [
      "The impulse response h(t) is the output of an LTI system when the input is a Dirac delta. Because every signal is a superposition of delayed impulses, h(t) completely determines the system.",
      "The step response is the integral of the impulse response (or the response to the unit step u(t)). It is often easier to measure and directly shows rise time, overshoot, and steady-state value.",
      "In discrete time the unit-sample response h[n] plays the same role; the step response is the cumulative sum of h[n].",
      "Stability, causality, and memory properties can all be read from h(t) or h[n].",
    ],
  },
  {
    id: "sampling",
    title: "Sampling Theorem",
    subtitle: "Samples above 2B recover a bandlimited signal",
    icon: Binary,
    realLife:
      "Every ADC, digital audio interface, and software-defined radio samples a continuous waveform. If the sampling rate is high enough and anti-alias filtering is used, perfect reconstruction is theoretically possible.",
    formula: "x(t) = Σₙ x(nT) sinc((t − nT)/T)\nT < 1/(2B)",
    formulaNote: "Nyquist rate = 2B samples/second",
    tags: ["Sampling", "Nyquist", "Reconstruction"],
    discussion: [
      "If a signal contains no energy above B hertz, sampling it at intervals T < 1/(2B) captures all the information. The continuous waveform can be rebuilt by interpolating the samples with sinc functions.",
      "The proof follows from the fact that sampling multiplies by a impulse train, which replicates the spectrum at every multiple of the sampling frequency; the replicas do not overlap when the Nyquist condition holds, so an ideal low-pass filter recovers the original spectrum.",
      "In practice we never have ideal sincs or ideal bandlimiting, so we oversample and use practical reconstruction filters.",
      "Understanding the sampling theorem prevents the most common digital-signal-processing mistakes: aliasing and inadequate anti-alias filtering.",
    ],
  },
  {
    id: "aliasing",
    title: "Aliasing",
    subtitle: "Too-slow sampling folds high frequencies into low ones",
    icon: Repeat,
    realLife:
      "The wagon-wheel effect in movies, moiré patterns in digital photos, and the wrong pitch of a badly sampled tone are all aliases. Anti-aliasing filters exist precisely to stop them.",
    formula: "f_alias = |f − k f_s|  (closest to baseband)",
    formulaNote: "Occurs when f_s ≤ 2B",
    tags: ["Sampling", "Aliasing", "Artifacts"],
    discussion: [
      "When the sampling rate is too low, the spectral replicas created by sampling overlap. High-frequency energy appears at lower frequencies—this is aliasing.",
      "A sinusoid of frequency f sampled at f_s is indistinguishable from a sinusoid of frequency |f − k f_s| for any integer k. The observer therefore “sees” a false lower frequency.",
      "The only reliable prevention is an analog anti-aliasing filter that removes energy above f_s/2 before the sampler.",
      "Once aliasing has occurred, no digital processing can uniquely undo it; the information is irreversibly mixed.",
    ],
  },
  {
    id: "frequency-response",
    title: "Frequency Response",
    subtitle: "H(jω) = gain and phase at every frequency",
    icon: Gauge,
    realLife:
      "Bode plots, equalizer curves, loudspeaker response graphs, and the “tone” of a guitar amplifier are all frequency responses. They tell you how the system treats each pure tone.",
    formula: "H(jω) = |H(jω)| e^{j∠H(jω)}\ny(t) = |H| cos(ωt + ∠H)  for input cos(ωt)",
    tags: ["LTI", "Bode", "Filtering"],
    discussion: [
      "For a stable LTI system the response to a everlasting sinusoid e^{jωt} is the same sinusoid multiplied by the complex number H(jω)—the frequency response.",
      "|H(jω)| is the gain (amplitude scaling) and ∠H(jω) is the phase shift introduced at that frequency.",
      "Plotting 20 log₁₀|H| versus log ω (Bode magnitude) and phase versus log ω is the standard way engineers visualize filters and control systems.",
      "The frequency response is exactly the Fourier transform of the impulse response: H(jω) = ∫ h(t) e^{−jωt} dt.",
    ],
  },
  {
    id: "transfer-function",
    title: "Transfer Function",
    subtitle: "H(s) or H(z) – system description in the transform domain",
    icon: Cpu,
    realLife:
      "Control engineers design PID controllers by placing poles and zeros of H(s). Digital filter designers do the same with H(z). Circuit simulators compute transfer functions automatically from netlists.",
    formula: "H(s) = Y(s)/X(s)  (Laplace)\nH(z) = Y(z)/X(z)  (z-transform)",
    tags: ["Laplace", "z-transform", "Poles/Zeros"],
    discussion: [
      "The transfer function is the ratio of the Laplace (or z) transform of the output to that of the input under zero initial conditions. It completely characterizes a linear constant-coefficient system.",
      "Poles of H(s) determine natural modes and stability; zeros shape the frequency response. The same statements hold for H(z) with the unit circle replacing the jω axis.",
      "Evaluating H(s) on the imaginary axis (s = jω) recovers the frequency response of a continuous-time system; evaluating H(z) on the unit circle recovers the DTFT of the impulse response.",
      "Cascade, parallel, and feedback interconnections become simple algebra with transfer functions—hence their central role in control and filter design.",
    ],
  },
  {
    id: "modulation",
    title: "Amplitude Modulation",
    subtitle: "Message × carrier → translated spectrum",
    icon: AudioLines,
    realLife:
      "AM radio, the RF stages of Wi-Fi and cellular transmitters, and many sensor telemetry links still use amplitude modulation or its digital cousins (ASK, QAM).",
    formula: "s(t) = [A + m(t)] cos(ω_c t)",
    formulaNote: "Spectrum of m appears around ±ω_c",
    tags: ["Modulation", "AM", "Communications"],
    discussion: [
      "Amplitude modulation multiplies a message m(t) by a high-frequency carrier. The resulting spectrum consists of the original message spectrum shifted to ± the carrier frequency.",
      "If a DC offset A is added (A > |m|), a residual carrier appears and simple envelope detection can recover the message.",
      "The same principle underlies frequency-division multiplexing: many messages can share a channel by riding on different carriers.",
      "Modern digital modulations (QAM, OFDM) are sophisticated descendants of the same frequency-shift idea.",
    ],
  },
  {
    id: "correlation",
    title: "Correlation",
    subtitle: "Measure of similarity between two signals",
    icon: MoveHorizontal,
    realLife:
      "Matched filters in radar and GPS, echo cancellation, and template matching in computer vision all compute correlations. The peak location tells you the relative delay; the peak height tells you how similar the signals are.",
    formula: "R_{xy}(τ) = ∫ x(t) y*(t−τ) dt",
    formulaNote: "Autocorrelation when x = y",
    tags: ["Matched filter", "Similarity", "Delay"],
    discussion: [
      "The cross-correlation of two signals measures how much they resemble each other as one is slid past the other. Its peak occurs at the relative time shift that best aligns them.",
      "Autocorrelation is the special case of a signal with itself. For a white noise the autocorrelation is an impulse; for a periodic signal it is periodic with the same period.",
      "The Wiener–Khinchin theorem says that the Fourier transform of the autocorrelation is the power spectral density—linking time-domain similarity to frequency-domain energy distribution.",
      "Matched-filter detection correlates a received waveform with a known template; the output SNR is maximized precisely when the template equals the expected signal shape.",
    ],
  },
  {
    id: "discrete-time-ft",
    title: "Discrete-Time Fourier Transform",
    subtitle: "Spectrum of a discrete-time sequence",
    icon: Binary,
    realLife:
      "The DTFT is the theoretical spectrum of any digital signal. Practical FFTs are simply sampled versions of the DTFT of a finite window of data.",
    formula: "X(e^{jω}) = Σₙ x[n] e^{−jω n}",
    formulaNote: "2π-periodic in ω",
    tags: ["DTFT", "Discrete", "Spectrum"],
    discussion: [
      "The discrete-time Fourier transform maps a sequence x[n] to a continuous, 2π-periodic function of frequency. It is the natural spectrum for digital signals.",
      "Because the time variable is discrete, the frequency domain is continuous but periodic—the opposite of the continuous-time Fourier transform.",
      "All the familiar properties (linearity, shift, convolution, Parseval) have discrete-time counterparts.",
      "When we compute an N-point FFT we are evaluating the DTFT of a length-N window at N equally spaced frequencies.",
    ],
  },
  {
    id: "dtft",
    title: "DTFT Properties & Periodicity",
    subtitle: "2π-periodic spectrum of discrete signals",
    icon: Repeat,
    realLife:
      "Because the DTFT is always 2π-periodic, digital filters are designed on the unit circle, and frequency-response plots are conventionally drawn from −π to π (or 0 to 2π).",
    formula: "X(e^{j(ω+2π)}) = X(e^{jω})",
    tags: ["DTFT", "Periodicity", "Unit circle"],
    discussion: [
      "Sampling in time produces periodicity in frequency. Consequently every DTFT repeats every 2π radians.",
      "We therefore only need to look at one period, usually [−π, π] or [0, 2π]. The point ω = π corresponds to the Nyquist frequency (half the sampling rate).",
      "Digital low-pass, high-pass and band-pass filters are specified by their behavior on this single period of the unit circle.",
      "Aliasing can also be understood as the overlapping of these periodic replicas when a continuous-time signal is sampled too slowly.",
    ],
  },
  {
    id: "z-transform",
    title: "z-Transform",
    subtitle: "Generalized frequency for discrete LTI systems",
    icon: Cpu,
    realLife:
      "IIR filter design, control of digital systems, and stability tests (poles inside the unit circle) are all carried out with the z-transform.",
    formula: "X(z) = Σₙ x[n] z^{−n}",
    formulaNote: "DTFT = X(z) on the unit circle |z|=1",
    tags: ["z-transform", "Poles", "Stability"],
    discussion: [
      "The z-transform replaces the complex exponential e^{jω} of the DTFT by a general complex variable z. This gives a larger region of convergence and turns difference equations into algebraic ones.",
      "The DTFT is recovered by evaluating X(z) on the unit circle |z| = 1 (when that circle lies inside the region of convergence).",
      "Poles of a transfer function H(z) inside the unit circle imply BIBO stability for causal systems; zeros can be placed to shape the frequency response.",
      "Partial-fraction expansion of X(z) yields the inverse transform and is the standard way to solve linear constant-coefficient difference equations.",
    ],
  },
];
