<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 20)->default('todo'); // todo, in_progress, done
            $table->string('priority', 20)->default('medium'); // low, medium, high
            $table->date('due_date')->nullable();
            $table->timestamps();

            // Indexes for filtered and ordered listing (aligns with TaskController index query)
            $table->index(['user_id', 'status']);       // Filter by status
            $table->index(['user_id', 'due_date']);    // Filter by due date
            $table->index(['user_id', 'created_at']);  // Default order: list by created_at desc
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
