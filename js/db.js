// DB CRUD operations utilizing Supabase client
(function() {
  window.db = {
    // Teachers / Profiles
    async getTeachers() {
      const client = await window.getSupabaseClient();
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('role', 'teacher')
        .order('name');
      if (error) throw error;
      return data;
    },

    async createTeacherProfile(id, name, employeeId, phone) {
      const client = await window.getSupabaseClient();
      const { data, error } = await client
        .from('profiles')
        .insert([{ id, name, role: 'teacher', employee_id: employeeId, phone }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    // Classes & Allotments
    async getClasses() {
      const client = await window.getSupabaseClient();
      const { data, error } = await client
        .from('classes')
        .select('*, profiles(name)')
        .order('class_num')
        .order('section');
      if (error) throw error;
      return data;
    },

    async updateClassTeacher(classId, teacherId) {
      const client = await window.getSupabaseClient();
      const { data, error } = await client
        .from('classes')
        .update({ teacher_id: teacherId || null })
        .eq('id', classId)
        .select();
      if (error) throw error;
      return data;
    },

    // Allotment mapping
    async getClassSubjectTeachers() {
      const client = await window.getSupabaseClient();
      const { data, error } = await client
        .from('class_subject_teachers')
        .select('*, classes(*), profiles(name)');
      if (error) throw error;
      return data;
    },

    async allotSubjectTeacher(classId, subject, teacherId) {
      const client = await window.getSupabaseClient();
      const { data, error } = await client
        .from('class_subject_teachers')
        .upsert([{ class_id: classId, subject, teacher_id: teacherId }])
        .select();
      if (error) throw error;
      return data;
    },

    async removeSubjectTeacher(classId, subject) {
      const client = await window.getSupabaseClient();
      const { error } = await client
        .from('class_subject_teachers')
        .delete()
        .match({ class_id: classId, subject });
      if (error) throw error;
    },

    // Students
    async getStudents(filters = {}) {
      const client = await window.getSupabaseClient();
      let query = client
        .from('students')
        .select('*, classes(*)');

      if (filters.classId) {
        query = query.eq('class_id', filters.classId);
      }
      if (filters.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,roll_no.ilike.%${filters.search}%`);
      }

      const { data, error } = await query.order('name');
      if (error) throw error;
      return data;
    },

    async getStudentsByTeacher(teacherId) {
      const client = await window.getSupabaseClient();
      
      // Get classes where teacher is class teacher or subject teacher
      const { data: ctClasses, error: err1 } = await client
        .from('classes')
        .select('id')
        .eq('teacher_id', teacherId);
      if (err1) throw err1;

      const { data: stClasses, error: err2 } = await client
        .from('class_subject_teachers')
        .select('class_id')
        .eq('teacher_id', teacherId);
      if (err2) throw err2;

      const classIds = Array.from(new Set([
        ...ctClasses.map(c => c.id),
        ...stClasses.map(c => c.class_id)
      ]));

      if (classIds.length === 0) return [];

      const { data, error } = await client
        .from('students')
        .select('*, classes(*)')
        .in('class_id', classIds)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },

    async upsertStudent(student) {
      const client = await window.getSupabaseClient();
      const { data, error } = await client
        .from('students')
        .upsert([student])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async bulkInsertStudents(studentsList) {
      const client = await window.getSupabaseClient();
      // PostgreSQL cannot upsert the same unique key twice in one request.
      // Keep the last CSV row for a repeated class/roll number so an import is
      // deterministic and never fails halfway through.
      const uniqueStudents = Array.from(
        new Map(studentsList.map(student => [
          `${student.class_id}:${String(student.roll_no).trim()}`,
          { ...student, roll_no: String(student.roll_no).trim() }
        ])).values()
      );
      const { data, error } = await client
        .from('students')
        .upsert(uniqueStudents, { onConflict: 'class_id,roll_no' })
        .select();
      if (error) throw error;
      return { students: data, skippedDuplicates: studentsList.length - uniqueStudents.length };
    },

    async createTeacherAccounts(teachers) {
      const client = await window.getSupabaseClient();
      const { data: { session } } = await client.auth.getSession();
      if (!session) throw new Error('Your admin session has expired. Please sign in again.');

      const response = await fetch('/api/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ teachers })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to create teacher account(s).');
      return result;
    },

    // Passages
    async getPassages(isActiveOnly = true) {
      const client = await window.getSupabaseClient();
      let query = client.from('passages').select('*');
      if (isActiveOnly) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query.order('class_num').order('lang');
      if (error) throw error;
      return data;
    },

    async upsertPassage(passage) {
      const client = await window.getSupabaseClient();
      const { data, error } = await client
        .from('passages')
        .upsert([passage])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    // Sessions / Reading Fluency Results
    async saveSession(sessionData) {
      const client = await window.getSupabaseClient();
      const { data, error } = await client
        .from('sessions')
        .insert([sessionData])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async getSessions(filters = {}) {
      const client = await window.getSupabaseClient();
      let query = client
        .from('sessions')
        .select('*, students(*, classes(*)), profiles(name), passages(title)');

      if (filters.classId) {
        query = query.eq('students.class_id', filters.classId);
      }
      if (filters.studentId) {
        query = query.eq('student_id', filters.studentId);
      }
      if (filters.teacherId) {
        query = query.eq('teacher_id', filters.teacherId);
      }
      if (filters.startDate) {
        query = query.gte('session_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('session_date', filters.endDate);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async getStudentHistory(studentId) {
      const client = await window.getSupabaseClient();
      const { data, error } = await client
        .from('sessions')
        .select('*, passages(title)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },

    // Logs
    async logAction(action, details) {
      const client = await window.getSupabaseClient();
      if (!client) return;
      const user = (await client.auth.getSession()).data.session?.user;
      if (!user) return;
      await client
        .from('audit_log')
        .insert([{ user_id: user.id, action, details }]);
    }
  };
})();
