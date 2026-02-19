<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->token = $this->getTokenFor($this->user);
    }

    public function test_index_returns_paginated_tasks_for_authenticated_user(): void
    {
        Task::factory()->count(3)->for($this->user)->create();

        $response = $this->withHeaders($this->authHeaders($this->token))
            ->getJson('/api/tasks');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data',
                'current_page',
                'last_page',
                'per_page',
                'total',
            ])
            ->assertJsonCount(3, 'data');
    }

    public function test_index_does_not_return_other_users_tasks(): void
    {
        $other = User::factory()->create();
        Task::factory()->count(2)->for($other)->create();
        Task::factory()->count(1)->for($this->user)->create();

        $response = $this->withHeaders($this->authHeaders($this->token))
            ->getJson('/api/tasks');

        $response->assertStatus(200)->assertJsonCount(1, 'data');
    }

    public function test_store_creates_task_and_returns_201(): void
    {
        $payload = [
            'title' => 'New task',
            'description' => 'Optional description',
            'status' => 'todo',
            'priority' => 'high',
            'due_date' => '2025-12-31',
        ];

        $response = $this->withHeaders($this->authHeaders($this->token))
            ->postJson('/api/tasks', $payload);

        $response->assertStatus(201)
            ->assertJsonFragment(['title' => 'New task', 'priority' => 'high']);

        $this->assertDatabaseHas('tasks', [
            'title' => 'New task',
            'user_id' => $this->user->id,
        ]);
    }

    public function test_store_returns_422_when_title_missing(): void
    {
        $response = $this->withHeaders($this->authHeaders($this->token))
            ->postJson('/api/tasks', [
                'title' => '',
                'status' => 'todo',
            ]);

        $response->assertStatus(422)->assertJsonValidationErrors(['title']);
    }

    public function test_show_returns_task_when_owner(): void
    {
        $task = Task::factory()->for($this->user)->create(['title' => 'My task']);

        $response = $this->withHeaders($this->authHeaders($this->token))
            ->getJson('/api/tasks/' . $task->id);

        $response->assertStatus(200)->assertJson(['id' => $task->id, 'title' => 'My task']);
    }

    public function test_show_returns_404_for_other_users_task(): void
    {
        $other = User::factory()->create();
        $task = Task::factory()->for($other)->create();

        $response = $this->withHeaders($this->authHeaders($this->token))
            ->getJson('/api/tasks/' . $task->id);

        $response->assertStatus(404);
    }

    public function test_update_returns_updated_task_when_owner(): void
    {
        $task = Task::factory()->for($this->user)->create(['title' => 'Original']);

        $response = $this->withHeaders($this->authHeaders($this->token))
            ->patchJson('/api/tasks/' . $task->id, [
                'title' => 'Updated title',
                'status' => 'done',
            ]);

        $response->assertStatus(200)
            ->assertJson(['title' => 'Updated title', 'status' => 'done']);

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'title' => 'Updated title']);
    }

    public function test_update_returns_404_for_other_users_task(): void
    {
        $other = User::factory()->create();
        $task = Task::factory()->for($other)->create();

        $response = $this->withHeaders($this->authHeaders($this->token))
            ->patchJson('/api/tasks/' . $task->id, ['title' => 'Hacked']);

        $response->assertStatus(404);
    }

    public function test_destroy_returns_204_and_deletes_task_when_owner(): void
    {
        $task = Task::factory()->for($this->user)->create();

        $response = $this->withHeaders($this->authHeaders($this->token))
            ->deleteJson('/api/tasks/' . $task->id);

        $response->assertStatus(204);
        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);
    }

    public function test_destroy_returns_404_for_other_users_task(): void
    {
        $other = User::factory()->create();
        $task = Task::factory()->for($other)->create();

        $response = $this->withHeaders($this->authHeaders($this->token))
            ->deleteJson('/api/tasks/' . $task->id);

        $response->assertStatus(404);
        $this->assertDatabaseHas('tasks', ['id' => $task->id]);
    }
}
