#Strategic Planner

A high-performance Progressive Web Application (PWA) designed for TESDA (WorldSkills/HRDC) to streamline the 2026-2030 strategic planning cycle. The tool automates the transition from environmental analysis (SWOT) to performance management (Balanced Scorecard).

🚀 Key Features

PAPs Management: Track Programs, Activities, and Projects with automated budget totaling.

AI-Powered SWOT Analysis:

Input Strengths, Weaknesses, Opportunities, and Threats.

Use the AI Strategy Generator (Gemini 2.5 Flash) to automatically derive SO, ST, WO, and WT strategic options.

AI Balanced Scorecard (BSC):

Smart categorization of strategic objectives into the four perspectives (Stakeholder, Internal Process, Learning & Growth, Financial).

Automated KPI measure suggestions based on objective descriptions.

Strategic Plan View: A print-ready, professional report generator for official documentation.

Offline Capability: Works as a PWA with local data persistence.

🛠️ Installation & Setup

Clone the repository:

git clone [https://github.com/your-org/strategic-plan-pwa.git](https://github.com/your-org/strategic-plan-pwa.git)


Open the App:
The application is built as a single-file solution (strategic_plan_pwa.html). Simply open this file in any modern web browser.

AI Configuration:
To enable AI features, ensure your environment provides a valid Gemini API Key. In a standalone environment, you can edit the apiKey constant at the top of the script.

🤖 AI Usage Instructions

Strategic Options Generation

Navigate to the SWOT Analysis tab.

Enter at least one item for each SWOT category.

Click the "Generate Strategies" button. The AI will analyze the intersections (e.g., how your Strengths can exploit Opportunities) and provide four strategic trajectories.

BSC Categorization

Navigate to the Balanced Scorecard tab.

Type a strategic objective (e.g., "Enhance digital literacy for TVET trainers").

Click the Sparkle Icon or move focus away from the input field.

The AI will automatically select the "Learning & Growth" perspective and suggest a relevant KPI.

📋 Technical Stack

Frontend: React (via CDN), Tailwind CSS

AI Engine: Gemini 2.5 Flash API

Icons: Lucide Icons

Storage: Browser LocalStorage (with Firestore upgrade compatibility)

📄 License

This project is licensed under the MIT License - see the LICENSE section for details.
