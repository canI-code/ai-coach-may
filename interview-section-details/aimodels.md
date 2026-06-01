STT - 
faster-whisper (opensource)
groq whisper api (freemium)


AUDIO ANALYSIS
parselmouth (python wrapper) + librosa (opensource)
opensmile(opensource)

FILLER WORD DETECTION
Use transcript analysis. (NO AI MODEL NEEDED)

Sentiment:
cardiffnlp/twitter-roberta-base-sentiment-latest (HUGGINGFACE MODEL FREE)


Technical Implementation Methods for Audio Metrics
Speech Metrics (WPM, Pace, Pauses, Silence, Fillers)

    Methodology: Parse the JSON response array from your timestamped Whisper model.

        WPM / Speaking Pace: Take total word count divided by individual word timestamps:
        WPM=End Time−Start TimeTotal Words​×60

        Pause Duration / Silence Detection: Calculate the delta between successive word markers: Pause=Wordn+1​(start)−Wordn​(end). If a delta is >0.5 seconds, log it as a transition pause. If it crosses >2.5 seconds, flag it as a dead silence metric.

        Filler Word Detection: Run regex string-matching arrays on the text transcript output against localized patterns: \b(um|uh|like|basically|actually|you know)\b.

Sentiment Metrics (Trajectory, Shifts, Clarity)

    Methodology: Use a text-based Transformer pipeline running VADER Sentiment or an optimized DistilBERT-base-uncased-emotion model locally via HuggingFace Transformers.

        Sentiment Trajectory: Segment the interview transcript text based on individual question blocks. Calculate the compounding valence score per answer block to generate a time-series plot mapping the emotional progression.

        Communication Clarity: Compare structural filler word densities against overall sentence lengths to evaluate response efficiency.

Voice Feature Metrics (Loudness, Energy, Pitch, Tone)

    Methodology: Use Parselmouth (Praat) to parse the raw incoming audio stream:

        Pitch Variation: Extract the Fundamental Frequency tracking object (F0​) values across time frames, drop the invalid unvoiced zero values, and calculate the standard deviation of the pitch matrix to quantify vocal expressiveness.

        Loudness & Vocal Energy Variance: Utilize librosa.feature.rms to measure instantaneous root-mean-square amplitude across audio window slices. High standard deviations imply strong, intentional emphasis; zero variance signals flat, monotonous delivery.


BODY AND FACE ANALYSIS

CORE CV FRAMEWORK
MEDIAPIPE/ OPENCV/ NUMPY

EMOTION DETECTION 
Best Option: DeepFace (Python local library framework) (ALSO LIGHTWEIGHT)
Alternative 2: Hume AI API (FREEMIUM)
trpakov/vit-face-expression (HUGGING FACE MODEL FREE)

Technical Implementation Methods for Facial Expression Analysis
Metrics Derived From Expressions

    Methodology: Set up your client-side frame processor to capture an image vector every 2 seconds during active streaming. Pass this to your backend pipeline's evaluation handler.

        Composure Score: Track your Angry and Confused metric bounds. Composure is measured as the inverse presence of sudden negative spike structures during a technical session:
        Composure=100×(1.0−(Angry%​+Confused%​))

        Stress Indicator & Emotional Stability: Measure the variance of the localized emotional states across a rolling 30-second window matrix. If values flip rapidly between Neutral, Sad, and Surprised, flag the candidate's emotional trajectory as highly unstable.

EYE CONTACT AND GAZE TRACKING

CORE CV FRAMEWORK
MEDIAPIPE FACE MESH AND MEDIAPIPE IRIS

Technical Implementation Methods for Gaze Tracking

    Methodology: Extract the spatial orientation vector coordinates from the user's face.

        Head Pose Estimation (Yaw/Pitch): Select 6 distinct invariant facial anchor coordinates from MediaPipe Face Mesh (nose tip, chin, left/right eye corners, left/right mouth corners). Use OpenCV's cv2.solvePnP function combined with a standardized 3D reference model to generate the rotation matrix.

        Iris Centroid Tracking: Pinpoint the boundaries of the iris using MediaPipe Iris coordinates. Calculate the ratio of the iris center relative to the inner and outer eye corner landmarks (the horizontal and vertical eye ratios).

   Normal / Centered Gaze              Looking Sideways (Bad Indicator)
     [ (  .  ) ] [ (  .  ) ]             [ ( .   ) ] [ ( .   ) ]
    Yaw/Pitch: -10° to +10°             Yaw/Pitch outside target bounds

    Calculating Bad Indicators:

        Looking Down: A pitch tracking score crossing <−15∘ shows the user is looking down at notes or the keyboard.

        Looking Sideways / Long Distraction: A yaw tracking calculation exceeding >±15∘ relative to the central webcam anchor implies distraction. If this state persists uninterrupted for longer than 3.5 seconds, trigger a user payload update: "Avoid looking down frequently".
        
        
POSTURE ANALYSIS

MediaPipe Pose + OpenCV angle calculations

Technical Implementation Methods for Posture Metrics

    Methodology: Leverage MediaPipe Pose's coordinate system to extract the structural orientation metrics of the head and upper body torso.

       Shoulder Alignment                    Slouching / Forward Lean
       
    (Left Shoulder)---(Right Shoulder)       (Ear Landmark)
           \             /                     | \  <-- Pitch Angle Deviation
            \     |     /                      |  \
             (Mid-Point)                 (Shoulder Landmark)

Posture Signals & Behavioral Indicators

    Shoulder Level Alignment: Calculate the slope between the left shoulder marker (P11​) and the right shoulder marker (P12​):
    Slope=X12​−X11​Y12​−Y11​​

    If the computed angle deviates more than ±7∘ off the horizontal center axis, log a posture distortion indicating leaning or poor ergonomics.

    Slouching & Head Tilt: Measure the geometric angle formed between the ear (P7​), the shoulder (P11​), and the central vertical axis.

    Engagement Tracking Matrix:

        Confidence Posture: Shoulders aligned symmetrically, vertical head position held within standard parameters (±5∘), displaying regular conversational engagement.

        Defensive / Disengaged Posture: Shoulders compressed forward or neck angle leaning excessively backward (>20∘) from the default starting threshold matrix.


        

(HUGGING FACE ONLY APPROACH)

Model Pipeline,         Active Hugging Face Checkpoint,          VRAM Footprint,Execution Target
Speech to Text,         faster-whisper-small (int8 quantized),  ~450 MB,RTX 3050 Ti (CUDA)
Audio Features,         wav2vec2-base-San_Diego_Emotion,        ~360 MB,RTX 3050 Ti (CUDA)
Face Expression,        facial_emotions_image_detection,        ~340 MB,RTX 3050 Ti (CUDA)
Text Sentiment,         emotion-classification-model,           ~260 MB,Ryzen 7 CPU (Threaded)
Gaze & Posture,         MediaPipe Run Environment,              0 MB,Client Browser Front-End
,Total Running Footprint:,~1.41 GB / 4.0 GB,Perfectly Safe Overhead


