<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! auth('api')->check()) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $perPage = min((int) $request->input('per_page', 15), 100);

        $tasks = Task::forUser(auth('api')->id())
            ->when($request->filled('status'), fn ($q) => $q->status($request->input('status')))
            ->when($request->filled('priority'), fn ($q) => $q->priority($request->input('priority')))
            ->latest()
            ->paginate($perPage);

        return response()->json($tasks);
    }

    public function store(StoreTaskRequest $request): JsonResponse
    {
        $task = Task::create([
            ...$request->validated(),
            'user_id' => auth('api')->id(),
        ]);

        return response()->json($task, 201);
    }

    public function show(Task $task): JsonResponse
    {
        $this->authorize('view', $task);

        return response()->json($task);
    }

    public function update(UpdateTaskRequest $request, Task $task): JsonResponse
    {
        $this->authorize('update', $task);

        $task->update($request->validated());

        return response()->json($task);
    }

    public function destroy(Task $task): JsonResponse
    {
        $this->authorize('delete', $task);

        $task->delete();

        return response()->json(null, 204);
    }
}
