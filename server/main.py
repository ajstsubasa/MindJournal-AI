from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import router


def create_app() -> FastAPI:
    app = FastAPI(title="MindJournal Summarizer", version="0.1.0")
    # The weekly-summary route is public for the hackathon demo. CORS is not an
    # authentication boundary; production should use a specific app origin and user auth.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.include_router(router)
    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=80, reload=True)


if __name__ == "__main__":
    main()
