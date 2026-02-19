<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskApiUnauthenticatedTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Tasks index requires authentication; no token must yield 401.
     */
    public function test_index_returns_401_when_unauthenticated(): void
    {
        $response = $this->getJson('/api/tasks');

        $response->assertStatus(401);
    }
}
